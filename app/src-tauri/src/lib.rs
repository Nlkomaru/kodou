mod heart_rate;
mod osc;
mod recorder;

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, State, WindowEvent,
};
use tokio::sync::watch;

use heart_rate::{HeartRateDevice, HeartRateStatusEvent};
use recorder::HeartRateRecorder;

// 記録は同期処理なので std Mutex で共有し、exit時にも同期的にcloseできるようにする。
type SharedRecorder = Arc<Mutex<HeartRateRecorder>>;

// 連続切断時に指数的に待機する再接続バックオフの上限。
const MAX_RECONNECT_DELAY: Duration = Duration::from_secs(30);

// 再接続の待機時間を、切断が連続するほど指数的に長くする。
// 再接続が成功すれば呼び出し側で何度も0から数え直すため、ここでは前回の待機時間だけ覚える。
fn next_reconnect_delay(previous: Duration) -> Duration {
    if previous.is_zero() {
        Duration::from_secs(1)
    } else {
        (previous * 2).min(MAX_RECONNECT_DELAY)
    }
}

#[derive(Default)]
struct HeartRateMonitorState {
    // 現在動いている心拍ストリームを止めるためのハンドル。
    // 新しい接続を開始するときは、先に既存ストリームへ停止通知を送る。
    monitor: Mutex<Option<HeartRateMonitorControl>>,
}

struct HeartRateMonitorControl {
    stop_tx: watch::Sender<bool>,
    // このセッションの記録先。ユーザー停止・再接続ループ終了・アプリ終了のいずれでもここからcloseできる。
    recorder: Option<SharedRecorder>,
}

#[tauri::command]
async fn scan_heart_rate_monitors(
    scan_seconds: Option<u64>,
) -> Result<Vec<HeartRateDevice>, String> {
    // フロントエンドから渡された秒数をそのまま信頼せず、短すぎ/長すぎを丸める。
    let seconds = scan_seconds.unwrap_or(8).clamp(2, 30);
    heart_rate::scan_heart_rate_monitors(Duration::from_secs(seconds)).await
}

#[tauri::command]
async fn start_heart_rate_monitor(
    app: AppHandle,
    state: State<'_, HeartRateMonitorState>,
    device_id: String,
) -> Result<(), String> {
    // 同時に複数デバイスへ接続しないよう、開始前に既存ストリームを止める。
    stop_current_monitor(&state);

    let (stop_tx, stop_rx) = watch::channel(false);

    // 1セッション=1 Parquetファイル。再接続をまたいでも同じファイルへ追記し続ける。
    // 記録の初期化に失敗しても、モニタリング自体は続行できるようNoneで進める。
    // exit時に共有状態から同期closeできるよう、生成はspawnの外で行いstateにも持たせる。
    let recorder: Option<SharedRecorder> = match HeartRateRecorder::new(&app) {
        Ok(recorder) => Some(Arc::new(Mutex::new(recorder))),
        Err(error) => {
            let _ = app.emit(
                "heart-rate-status",
                HeartRateStatusEvent {
                    state: "warning",
                    message: format!("データ記録を開始できませんでした: {error}"),
                    device_id: Some(device_id.clone()),
                },
            );
            None
        }
    };

    {
        let mut monitor = state
            .monitor
            .lock()
            .map_err(|_| "心拍モニターの状態をロックできませんでした".to_string())?;
        *monitor = Some(HeartRateMonitorControl {
            stop_tx,
            recorder: recorder.clone(),
        });
    }

    // BLE通知の受信は長く動くため、Tauri command自体はすぐ返してバックグラウンドで処理する。
    tauri::async_runtime::spawn(async move {
        let mut reconnect_delay = Duration::ZERO;

        // ユーザーによる停止以外でストリームが終了したときは、
        // 指数バックオフで自動再接続を繰り返す。
        loop {
            // 再接続判定のために、ストリームへ渡すreceiverとは別に監視用のreceiverを残す。
            let watch_rx = stop_rx.clone();
            let stream_rx = stop_rx.clone();
            let result = heart_rate::stream_heart_rate(
                app.clone(),
                device_id.clone(),
                stream_rx,
                recorder.clone(),
            )
            .await;

            // 明示的な停止通知が来ていれば、再接続せずループを抜ける。
            let should_stop = *watch_rx.borrow();
            if should_stop {
                break;
            }

            match result {
                Ok(()) => {
                    // ストリームが正常終了したが停止要求がない場合は切断扱いで再接続する。
                    let _ = app.emit(
                        "heart-rate-status",
                        HeartRateStatusEvent {
                            state: "reconnecting",
                            message: "心拍センサーとの接続が切れたため再接続します".to_string(),
                            device_id: Some(device_id.clone()),
                        },
                    );
                }
                Err(error) => {
                    let _ = app.emit(
                        "heart-rate-status",
                        HeartRateStatusEvent {
                            state: "reconnecting",
                            message: format!("再接続します: {error}"),
                            device_id: Some(device_id.clone()),
                        },
                    );
                }
            }

            reconnect_delay = next_reconnect_delay(reconnect_delay);
            tokio::time::sleep(reconnect_delay).await;
        }

        // ユーザー停止でループを抜けたら、footerを書いてParquetを読める状態で確定する。
        // アプリ終了経由で既にcloseされていてもclose()は冪等なので二重呼び出しは無害。
        if let Some(recorder) = recorder {
            if let Ok(mut recorder) = recorder.lock() {
                if let Err(error) = recorder.close() {
                    let _ = app.emit(
                        "heart-rate-status",
                        HeartRateStatusEvent {
                            state: "warning",
                            message: format!("記録ファイルを確定できませんでした: {error}"),
                            device_id: Some(device_id.clone()),
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_heart_rate_monitor(state: State<'_, HeartRateMonitorState>) -> Result<(), String> {
    stop_current_monitor(&state);
    Ok(())
}

fn stop_current_monitor(state: &State<'_, HeartRateMonitorState>) {
    // 停止通知は失敗してもUI操作を止めるほどではないので、ここでは握りつぶす。
    if let Ok(mut monitor) = state.monitor.lock() {
        if let Some(current) = monitor.take() {
            let _ = current.stop_tx.send(true);
        }
    }
}

// アプリ終了時に、記録中のParquetファイルを同期的に確定(footer書き込み)する。
// 終了経路ではspawn済みタスクが動く保証がないため、共有状態のrecorderをここで直接closeする。
fn finalize_recording(app: &AppHandle) {
    let Some(state) = app.try_state::<HeartRateMonitorState>() else {
        return;
    };
    // monitorのロックはrecorderのArcを取り出すまでに留め、close処理はロック外で行う。
    let recorder = {
        let Ok(monitor) = state.monitor.lock() else {
            return;
        };
        let Some(current) = monitor.as_ref() else {
            return;
        };
        // ストリームタスクにも停止を伝えつつ、記録ハンドルだけ取り出す。
        let _ = current.stop_tx.send(true);
        current.recorder.clone()
    };
    if let Some(recorder) = recorder {
        if let Ok(mut recorder) = recorder.lock() {
            let _ = recorder.close();
        }
    }
}

// ウィンドウをトレイに隠して監視を継続する。見つからなければ何もしない。
fn hide_to_tray(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

// トレイやメニューからウィンドウを再表示して最前面へ。
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(HeartRateMonitorState::default())
        .manage(osc::OscState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_heart_rate_monitors,
            start_heart_rate_monitor,
            stop_heart_rate_monitor,
            osc::configure_osc,
            osc::send_osc
        ])
        .setup(|app| {
            // システムトレイに常駐させ、ウィンドウを閉じてもバックグラウンドで監視・記録・OSCを続けられるようにする。
            let show_item = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray = TrayIconBuilder::with_id("kodou-tray")
                .tooltip("kodou")
                .menu(&menu)
                // 左クリックはウィンドウ復帰に使いたいので、メニューは右クリック時だけ出す。
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    // 「終了」だけが本当のアプリ終了。RunEvent::Exitで記録ファイルを確定する。
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // ×ボタンでは終了せず、トレイへ隠して監視を継続する。終了はトレイの「終了」から。
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                hide_to_tray(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("Tauriアプリケーションの実行中にエラーが発生しました");

    app.run(|app_handle, event| {
        // アプリ終了の直前に、記録中のParquetをfooter込みで確定する。
        if let RunEvent::Exit = event {
            finalize_recording(app_handle);
        }
    });
}
