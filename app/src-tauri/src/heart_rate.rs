use btleplug::api::{Central, Characteristic, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::StreamExt;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::{sync::watch, time::timeout};
use uuid::Uuid;

use crate::recorder::{now_ms, HeartRateRecorder};

const HEART_RATE_SERVICE_UUID: Uuid = Uuid::from_u128(0x0000180d_0000_1000_8000_00805f9b34fb);
const HEART_RATE_MEASUREMENT_UUID: Uuid = Uuid::from_u128(0x00002a37_0000_1000_8000_00805f9b34fb);
const BATTERY_LEVEL_UUID: Uuid = Uuid::from_u128(0x00002a19_0000_1000_8000_00805f9b34fb);

// スキャン結果としてフロントエンドへ返すBLEデバイス情報。
// idはbtleplugの内部IDで、接続時にもこの値を使う。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartRateDevice {
    pub id: String,
    pub name: String,
    pub address: String,
    pub rssi: Option<i16>,
    pub services: Vec<String>,
}

// Heart Rate Measurement通知をフロントエンドへ流すためのpayload。
// バッテリーやセンサー接触状態は、デバイスが対応している場合だけ入る。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartRateReading {
    pub device_id: String,
    pub bpm: u16,
    pub rr_intervals_ms: Vec<u32>,
    pub energy_expended: Option<u16>,
    pub sensor_contact_detected: Option<bool>,
    pub battery_percent: Option<u8>,
}

// 接続状態や警告をUIへ伝えるためのイベント。
// stateはフロントエンド側の表示ロジックと対応している。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeartRateStatusEvent {
    pub state: &'static str,
    pub message: String,
    pub device_id: Option<String>,
}

// BLEパケットを解析した直後の内部表現。
// ここではまだdevice_idやバッテリー値を混ぜず、通知そのものの内容だけを持つ。
struct HeartRateMeasurement {
    bpm: u16,
    rr_intervals_ms: Vec<u32>,
    energy_expended: Option<u16>,
    sensor_contact_detected: Option<bool>,
}

// 接続準備が終わったあとのストリーミングに必要な情報一式。
// stream_heart_rate本体を「通知を読むループ」に集中させるためにまとめている。
struct HeartRateSession {
    peripheral: Peripheral,
    hr_characteristic: Characteristic,
    battery_characteristic: Option<Characteristic>,
    battery_percent: Option<u8>,
}

// Heart Rate Service(180D)を広告しているデバイスだけを一覧化する。
// 接続前のデバイス選択UIで使うため、ここでは接続やサービス探索は行わない。
pub async fn scan_heart_rate_monitors(
    scan_duration: Duration,
) -> Result<Vec<HeartRateDevice>, String> {
    let adapter = first_adapter().await?;

    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|error| format!("BLEスキャンを開始できませんでした: {error}"))?;

    // BLEスキャン結果は即時に全件揃うわけではないため、指定秒数だけ待ってから読む。
    tokio::time::sleep(scan_duration).await;

    let peripherals = adapter
        .peripherals()
        .await
        .map_err(|error| format!("BLEデバイス一覧を読み取れませんでした: {error}"))?;
    let mut devices = Vec::new();

    for peripheral in peripherals {
        if let Some(properties) = peripheral
            .properties()
            .await
            .map_err(|error| format!("BLEデバイスの情報を読み取れませんでした: {error}"))?
        {
            // 通常のBluetooth機器を除外し、心拍センサーとして見えるものだけを残す。
            if !properties.services.contains(&HEART_RATE_SERVICE_UUID) {
                continue;
            }

            devices.push(HeartRateDevice {
                id: peripheral.id().to_string(),
                name: properties
                    .local_name
                    .unwrap_or_else(|| "名前のない心拍センサー".to_string()),
                address: properties.address.to_string(),
                rssi: properties.rssi,
                services: properties
                    .services
                    .iter()
                    .map(ToString::to_string)
                    .collect(),
            });
        }
    }

    // stop_scanに失敗しても、取得済みの結果はUIへ返せるので致命扱いにしない。
    let _ = adapter.stop_scan().await;
    devices.sort_by(|a, b| a.name.cmp(&b.name).then_with(|| a.address.cmp(&b.address)));
    Ok(devices)
}

// 指定したデバイスIDの心拍セッションを確立し、心拍測定の通知を受け取ってフロントエンドに送る非同期関数。
// ユーザー操作による停止や、無通信タイムアウトもここで扱う。
pub async fn stream_heart_rate(
    app: AppHandle,
    device_id: String,
    mut stop_rx: watch::Receiver<bool>,
    recorder: Option<Arc<Mutex<HeartRateRecorder>>>,
) -> Result<(), String> {
    // recorder は std::sync::Mutex 前提。exit時に同期closeできるよう共有状態からも触る。
    let HeartRateSession {
        peripheral,
        hr_characteristic,
        battery_characteristic,
        mut battery_percent,
    } = connect_heart_rate_session(&app, &device_id).await?;

    peripheral
        .subscribe(&hr_characteristic)
        .await
        .map_err(|error| format!("心拍通知を購読できませんでした: {error}"))?;
    let mut notifications = peripheral
        .notifications()
        .await
        .map_err(|error| format!("BLE通知ストリームを開けませんでした: {error}"))?;

    emit_status(
        &app,
        "connected",
        "心拍通知を受信しています",
        Some(&device_id),
    );
    let mut battery_tick = tokio::time::interval(Duration::from_secs(60 * 5));

    // ユーザー操作による停止、定期的なバッテリー更新、BLE通知、無通信タイムアウトをひとつの受信ループで扱う。
    loop {
        tokio::select! {
            _ = stop_rx.changed() => {
                if *stop_rx.borrow() {
                    let _ = peripheral.disconnect().await;
                    emit_status(&app, "disconnected", "心拍モニタリングを停止しました", Some(&device_id));
                    return Ok(());
                }
            }
            _ = battery_tick.tick() => {
                // Battery Serviceは通知ではなくreadで読む。毎回読む必要はないので低頻度に更新する。
                if let Some(next_battery_percent) = read_battery(&peripheral, battery_characteristic.as_ref()).await {
                    battery_percent = Some(next_battery_percent);
                }
            }
            maybe_notification = notifications.next() => {
                let Some(notification) = maybe_notification else {
                    let _ = peripheral.disconnect().await;
                    emit_status(&app, "disconnected", "心拍通知ストリームが閉じられました", Some(&device_id));
                    return Ok(());
                };

                // 同じ通知ストリームに他のcharacteristicが混ざることがあるため、心拍通知だけ処理する。
                if notification.uuid != HEART_RATE_MEASUREMENT_UUID {
                    continue;
                }

                match parse_heart_rate_measurement(&notification.value) {
                    Ok(measurement) => {
                        // 接続直後に一部のBLEデバイスが送る初期値BPM=0を除外する。
                        // BPM=0は生理学的にあり得ず、記録の最小値や統計を汚染するため破棄する。
                        if measurement.bpm == 0 {
                            continue;
                        }
                        let reading = build_reading(&device_id, measurement, battery_percent);
                        // emitでreadingをmoveする前に、記録有効なら同じ内容をParquetへ1行追記する。
                        // recordは同期処理で.awaitをまたがないため、std Mutexを短時間ロックするだけで済む。
                        if let Some(recorder) = &recorder {
                            if let Ok(mut recorder) = recorder.lock() {
                                if let Err(error) = recorder.record(now_ms(), &reading) {
                                    emit_status(&app, "warning", &error, Some(&device_id));
                                }
                            }
                        }
                        let _ = app.emit("heart-rate-reading", reading);
                    }
                    Err(error) => {
                        emit_status(&app, "warning", &error, Some(&device_id));
                    }
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(30)) => {
                let _ = peripheral.disconnect().await;
                emit_status(&app, "error", "30秒間、心拍通知を受信できませんでした", Some(&device_id));
                return Ok(());
            }
        }
    }
}

// 指定したデバイスIDの心拍セッションを確立する非同期関数。スキャン、接続、サービス発見、キャラクタリスティックの検索を行う。
async fn connect_heart_rate_session(
    app: &AppHandle,
    device_id: &str,
) -> Result<HeartRateSession, String> {
    emit_status(
        app,
        "scanning",
        "選択した心拍センサーを探しています",
        Some(device_id),
    );
    let adapter = first_adapter().await?;
    let peripheral = find_peripheral(&adapter, device_id, Duration::from_secs(10)).await?;

    emit_status(
        app,
        "connecting",
        "心拍センサーに接続しています",
        Some(device_id),
    );
    ensure_connected(&peripheral).await?;

    peripheral
        .discover_services()
        .await
        .map_err(|error| format!("BLEサービスを検出できませんでした: {error}"))?;

    // 接続後にcharacteristic一覧を調べ、心拍通知と任意のバッテリー読取先を探す。
    let characteristics = peripheral.characteristics();
    let hr_characteristic = characteristics
        .iter()
        .find(|characteristic| characteristic.uuid == HEART_RATE_MEASUREMENT_UUID)
        .cloned()
        .ok_or_else(|| {
            "選択したデバイスは Heart Rate Measurement (2A37) を公開していません".to_string()
        })?;
    let battery_characteristic = characteristics
        .iter()
        .find(|characteristic| characteristic.uuid == BATTERY_LEVEL_UUID)
        .cloned();
    let battery_percent = read_battery(&peripheral, battery_characteristic.as_ref()).await;

    Ok(HeartRateSession {
        peripheral,
        hr_characteristic,
        battery_characteristic,
        battery_percent,
    })
}

// すでに接続済みならそのまま使い、未接続の場合だけ接続を試みる。
async fn ensure_connected(peripheral: &Peripheral) -> Result<(), String> {
    if peripheral
        .is_connected()
        .await
        .map_err(|error| format!("接続状態を読み取れませんでした: {error}"))?
    {
        return Ok(());
    }

    timeout(Duration::from_secs(15), peripheral.connect())
        .await
        .map_err(|_| "心拍センサーへの接続がタイムアウトしました".to_string())?
        .map_err(|error| format!("心拍センサーに接続できませんでした: {error}"))
}

// 現在利用可能な最初のBluetoothアダプターを使う。
// 複数アダプターの選択UIはまだ持たないため、ここでは単純に先頭を採用する。
async fn first_adapter() -> Result<Adapter, String> {
    let manager = Manager::new()
        .await
        .map_err(|error| format!("BLEマネージャーを作成できませんでした: {error}"))?;
    let adapters = manager
        .adapters()
        .await
        .map_err(|error| format!("BLEアダプター一覧を取得できませんでした: {error}"))?;

    adapters
        .into_iter()
        .next()
        .ok_or_else(|| "Bluetoothアダプターが見つかりませんでした".to_string())
}

async fn find_peripheral(
    adapter: &Adapter,
    device_id: &str,
    max_wait: Duration,
) -> Result<Peripheral, String> {
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|error| format!("BLEスキャンを開始できませんでした: {error}"))?;

    let started_at = std::time::Instant::now();
    loop {
        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|error| format!("BLEデバイス一覧を読み取れませんでした: {error}"))?;

        for peripheral in peripherals {
            // UIで選択したbtleplug IDと一致する場合が最優先。
            if peripheral.id().to_string() == device_id {
                let _ = adapter.stop_scan().await;
                return Ok(peripheral);
            }

            if let Some(properties) = peripheral
                .properties()
                .await
                .map_err(|error| format!("BLEデバイスの情報を読み取れませんでした: {error}"))?
            {
                let matches_address = properties.address.to_string() == device_id;
                let matches_name = properties.local_name.as_deref() == Some(device_id);

                // OSやアダプターによってID表現が変わることがあるため、補助的にアドレス/名前でも探す。
                if matches_address || matches_name {
                    let _ = adapter.stop_scan().await;
                    return Ok(peripheral);
                }
            }
        }

        if started_at.elapsed() >= max_wait {
            let _ = adapter.stop_scan().await;
            return Err("選択した心拍センサーが見つかりませんでした".to_string());
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

// Battery Level(2A19)がある場合だけ現在値を読む。対応していないデバイスではNoneになる。
async fn read_battery(
    peripheral: &Peripheral,
    characteristic: Option<&Characteristic>,
) -> Option<u8> {
    let characteristic = characteristic?;
    peripheral
        .read(characteristic)
        .await
        .ok()
        .and_then(|value| value.first().copied())
}

// 内部measurementに、接続中デバイスIDと直近バッテリー値を足してUI向けpayloadにする。
fn build_reading(
    device_id: &str,
    measurement: HeartRateMeasurement,
    battery_percent: Option<u8>,
) -> HeartRateReading {
    HeartRateReading {
        device_id: device_id.to_string(),
        bpm: measurement.bpm,
        rr_intervals_ms: measurement.rr_intervals_ms,
        energy_expended: measurement.energy_expended,
        sensor_contact_detected: measurement.sensor_contact_detected,
        battery_percent,
    }
}

fn parse_heart_rate_measurement(data: &[u8]) -> Result<HeartRateMeasurement, String> {
    if data.len() < 2 {
        return Err("不正な心拍測定パケットを受信しました".to_string());
    }

    let flags = data[0];
    let mut cursor = 1;
    // Bluetooth Heart Rate Measurement は、フラグのビットで後続の任意フィールド有無を示す。
    // 各フィールドは固定順で詰められるため、cursorを進めながら順に読み取る。
    let is_16_bit = flags & 0b0000_0001 != 0;
    let sensor_contact_detected = if flags & 0b0000_0100 != 0 {
        Some(flags & 0b0000_0010 != 0)
    } else {
        None
    };

    let bpm = if is_16_bit {
        if data.len() < cursor + 2 {
            return Err("不正な16ビット心拍値を受信しました".to_string());
        }
        let bpm = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
        cursor += 2;
        bpm
    } else {
        let bpm = data[cursor] as u16;
        cursor += 1;
        bpm
    };

    let energy_expended = if flags & 0b0000_1000 != 0 {
        if data.len() < cursor + 2 {
            return Err("不正な消費エネルギー値を受信しました".to_string());
        }
        let value = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
        cursor += 2;
        Some(value)
    } else {
        None
    };

    let mut rr_intervals_ms = Vec::new();
    if flags & 0b0001_0000 != 0 {
        // RR intervalは1/1024秒単位で送られる。UIでは扱いやすいmsに丸める。
        while data.len() >= cursor + 2 {
            let raw = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
            rr_intervals_ms.push(((raw as f32 / 1024.0) * 1000.0).round() as u32);
            cursor += 2;
        }
    }

    Ok(HeartRateMeasurement {
        bpm,
        rr_intervals_ms,
        energy_expended,
        sensor_contact_detected,
    })
}

// フロントエンド側ではこのイベントを購読して、接続状態やエラー表示を更新する。
fn emit_status(app: &AppHandle, state: &'static str, message: &str, device_id: Option<&str>) {
    let _ = app.emit(
        "heart-rate-status",
        HeartRateStatusEvent {
            state,
            message: message.to_string(),
            device_id: device_id.map(ToString::to_string),
        },
    );
}
