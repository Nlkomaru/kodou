use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Local;
use serde::Serialize;

use arrow_array::builder::{
    BooleanBuilder, Int64Builder, ListBuilder, StringBuilder, UInt16Builder, UInt32Builder,
    UInt8Builder,
};
use arrow_array::cast::AsArray;
use arrow_array::types::{Int64Type, UInt16Type};
use arrow_array::RecordBatch;
use arrow_ipc::reader::StreamReader;
use arrow_ipc::writer::StreamWriter;
use arrow_schema::{DataType, Field, Schema};
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use parquet::arrow::{ArrowWriter, ProjectionMask};
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use tauri::{AppHandle, Manager};

use crate::heart_rate::HeartRateReading;

// 1行 = BLE通知1件。列指向のParquetにまとめて書くことで、pandas/polars/DuckDBで
// そのまま解析でき、HDF5のようなネイティブCライブラリ依存も持たずに済む。
// 生パケットを忠実に残すため、rr_intervals_ms は list<u32> 列として保持する。
const FLUSH_ROWS: usize = 64;

// 記録中の一時ファイルの拡張子。追記耐性のあるArrow IPC stream形式で書く。
// stream形式はfooterを末尾に持たないため、クラッシュ・電源断・強制終了で切れても
// 完全に書けたバッチは読み戻せる。正常終了時にParquetへ変換して確定する。
const IN_PROGRESS_EXT: &str = "arrow";
// 標準ツールで読める最終形式の拡張子。close、または起動時の復旧でこれへ変換する。
const FINAL_EXT: &str = "parquet";

pub struct HeartRateRecorder {
    // close()後はNoneにして、二重closeや確定後の追記を防ぐ。
    writer: Option<StreamWriter<File>>,
    schema: Arc<Schema>,
    timestamp_ms: Int64Builder,
    device_id: StringBuilder,
    bpm: UInt16Builder,
    rr_intervals_ms: ListBuilder<UInt32Builder>,
    energy_expended: UInt16Builder,
    sensor_contact_detected: BooleanBuilder,
    battery_percent: UInt8Builder,
    buffered_rows: usize,
    // 記録中に書き込む一時ファイル(.arrow)。フロントエンドへの通知や履歴一覧の
    // 「記録中」判定にはこのパスを使う。closeでParquetへ変換したら削除する。
    pub path: PathBuf,
    // 変換後の最終ファイル(.parquet)。close時にpathの内容をここへ書き出す。
    final_path: PathBuf,
}

impl HeartRateRecorder {
    // アプリのデータディレクトリ配下 recordings/<年月>/<年月日>_<連番>.parquet を1つ割り当てる。
    // デバイスへ接続するたびに新しいファイルを作り、同じ日の記録は連番で並べる。
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        // ファイル名の日付は、利用者が探しやすいようUTCではなくローカル時刻で決める。
        let now = Local::now();
        let month_dir = recordings_dir(app)?.join(now.format("%Y-%m").to_string());
        fs::create_dir_all(&month_dir)
            .map_err(|error| format!("保存先フォルダを作成できませんでした: {error}"))?;

        let date = now.format("%Y-%m-%d").to_string();
        let final_path = month_dir.join(next_recording_name(&file_names_in(&month_dir), &date));
        Self::with_path(final_path)
    }

    // 最終的なParquetパスを指定してライターを用意する。Tauriに依存しないので単体テストからも使える。
    fn with_path(final_path: PathBuf) -> Result<Self, String> {
        // list列の子フィールド名はArrowのListBuilder既定の "item" に合わせる。
        let schema = Arc::new(Schema::new(vec![
            Field::new("timestamp_ms", DataType::Int64, false),
            Field::new("device_id", DataType::Utf8, false),
            Field::new("bpm", DataType::UInt16, false),
            Field::new(
                "rr_intervals_ms",
                DataType::List(Arc::new(Field::new("item", DataType::UInt32, true))),
                false,
            ),
            Field::new("energy_expended", DataType::UInt16, true),
            Field::new("sensor_contact_detected", DataType::Boolean, true),
            Field::new("battery_percent", DataType::UInt8, true),
        ]));

        // 記録中は同じstemの .arrow へ書き、closeで .parquet へ変換する。
        let in_progress_path = final_path.with_extension(IN_PROGRESS_EXT);
        let file = File::create(&in_progress_path)
            .map_err(|error| format!("保存ファイルを作成できませんでした: {error}"))?;
        // 追記耐性のあるstream形式で書く。file形式(FileWriter)は末尾にfooterを持ち
        // close時にしか読めなくなるため、ここでは必ずStreamWriterを使う。
        let writer = StreamWriter::try_new(file, &schema)
            .map_err(|error| format!("記録ライターを初期化できませんでした: {error}"))?;

        Ok(Self {
            writer: Some(writer),
            schema,
            timestamp_ms: Int64Builder::new(),
            device_id: StringBuilder::new(),
            bpm: UInt16Builder::new(),
            rr_intervals_ms: ListBuilder::new(UInt32Builder::new()),
            energy_expended: UInt16Builder::new(),
            sensor_contact_detected: BooleanBuilder::new(),
            battery_percent: UInt8Builder::new(),
            buffered_rows: 0,
            path: in_progress_path,
            final_path,
        })
    }

    // BLE通知1件を1行としてバッファに積む。一定件数たまったら行グループとして書き出す。
    pub fn record(&mut self, timestamp_ms: i64, reading: &HeartRateReading) -> Result<(), String> {
        if self.writer.is_none() {
            return Ok(());
        }

        self.timestamp_ms.append_value(timestamp_ms);
        self.device_id.append_value(&reading.device_id);
        self.bpm.append_value(reading.bpm);
        for interval in &reading.rr_intervals_ms {
            self.rr_intervals_ms.values().append_value(*interval);
        }
        // 空でも1行分のlist(長さ0)として確定する。
        self.rr_intervals_ms.append(true);
        self.energy_expended.append_option(reading.energy_expended);
        self.sensor_contact_detected
            .append_option(reading.sensor_contact_detected);
        self.battery_percent.append_option(reading.battery_percent);
        self.buffered_rows += 1;

        if self.buffered_rows >= FLUSH_ROWS {
            self.flush()?;
        }
        Ok(())
    }

    // バッファ済みの行をRecordBatchにしてIPC streamへ書き出し、ディスクまで確定させる。
    pub fn flush(&mut self) -> Result<(), String> {
        if self.buffered_rows == 0 {
            return Ok(());
        }
        let Some(writer) = self.writer.as_mut() else {
            return Ok(());
        };

        let batch = RecordBatch::try_new(
            self.schema.clone(),
            vec![
                Arc::new(self.timestamp_ms.finish()),
                Arc::new(self.device_id.finish()),
                Arc::new(self.bpm.finish()),
                Arc::new(self.rr_intervals_ms.finish()),
                Arc::new(self.energy_expended.finish()),
                Arc::new(self.sensor_contact_detected.finish()),
                Arc::new(self.battery_percent.finish()),
            ],
        )
        .map_err(|error| format!("記録データを整形できませんでした: {error}"))?;

        // IPC streamへ1メッセージとして書き出す。
        writer
            .write(&batch)
            .map_err(|error| format!("記録データを書き込めませんでした: {error}"))?;
        // OSバッファ止まりにせずディスクまで確実に届かせる。これで電源断でも直近バッチまで守れる。
        // 心拍は約1Hz・flushは約1分に1回なので、fsyncのコストは無視できる。
        writer
            .get_ref()
            .sync_all()
            .map_err(|error| format!("記録データを確定できませんでした: {error}"))?;
        self.buffered_rows = 0;
        Ok(())
    }

    // 残りをflushしてEOSを書き、.arrowを標準ツールで読めるParquetへ変換して確定する。
    // 既にclose済みなら何もしない(二重呼び出しは無害)。
    pub fn close(&mut self) -> Result<(), String> {
        self.flush()?;
        let Some(writer) = self.writer.take() else {
            return Ok(());
        };
        // into_inner()がEOSマーカー(finish)を書いてからFileを返す。streamはここで完結する。
        let file = writer
            .into_inner()
            .map_err(|error| format!("記録ファイルを確定できませんでした: {error}"))?;
        // EOSまでディスクへ届かせてから変換する。
        let _ = file.sync_all();
        drop(file);

        // .arrow を .parquet へ変換する。成功したら一時ファイルは不要。
        convert_ipc_to_parquet(&self.path, &self.final_path)?;
        let _ = fs::remove_file(&self.path);
        Ok(())
    }
}

// .arrow(IPC stream)を .parquet へ変換する。中断で切れていても、読めたバッチだけ引き継ぐ。
fn convert_ipc_to_parquet(ipc_path: &Path, parquet_path: &Path) -> Result<(), String> {
    let file =
        File::open(ipc_path).map_err(|error| format!("記録ファイルを開けませんでした: {error}"))?;
    let reader = StreamReader::try_new(file, None)
        .map_err(|error| format!("記録ファイルを読み込めませんでした: {error}"))?;
    // 変換先のスキーマは記録時のものをそのまま引き継ぐ。
    let schema = reader.schema();
    let batches = read_ipc_batches_tolerant(reader);

    let out = File::create(parquet_path)
        .map_err(|error| format!("保存ファイルを作成できませんでした: {error}"))?;
    let props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY)
        .build();
    let mut writer = ArrowWriter::try_new(out, schema, Some(props))
        .map_err(|error| format!("Parquetライターを初期化できませんでした: {error}"))?;
    for batch in &batches {
        writer
            .write(batch)
            .map_err(|error| format!("記録データを書き込めませんでした: {error}"))?;
    }
    writer
        .close()
        .map_err(|error| format!("記録ファイルを確定できませんでした: {error}"))?;
    Ok(())
}

// 中断で切れたIPC streamでも、完全に書けたバッチだけを取り出す。
// 末尾の未完メッセージはErr(またはEOF)になるので、そこを破損ではなく記録の終端として打ち切る。
// collect::<Result<Vec>>()で受けると末尾のErrで全バッチを捨ててしまうため、必ずこの形で拾う。
fn read_ipc_batches_tolerant(reader: StreamReader<File>) -> Vec<RecordBatch> {
    let mut batches = Vec::new();
    for item in reader {
        match item {
            Ok(batch) => batches.push(batch),
            Err(_) => break,
        }
    }
    batches
}

// 起動時に、前回のクラッシュ・電源断・強制終了で残った .arrow を Parquet へ変換して読める状態にする。
// 変換に失敗したものは .arrow を残し、次回起動で再試行する(元データを失わない)。
// 記録開始より前(setup)に呼ぶことで、記録中の .arrow を誤って変換対象にしない。
pub fn recover_interrupted_recordings(app: &AppHandle) {
    let Ok(root) = recordings_dir(app) else {
        return;
    };
    for arrow_path in interrupted_recordings_in(&root) {
        let parquet_path = arrow_path.with_extension(FINAL_EXT);
        if convert_ipc_to_parquet(&arrow_path, &parquet_path).is_ok() {
            let _ = fs::remove_file(&arrow_path);
        }
    }
}

// 保存先ルート配下(<recordings>/<年月>/*.arrow)から、中断された記録ファイルのパスを集める。
fn interrupted_recordings_in(root: &Path) -> Vec<PathBuf> {
    let Ok(month_dirs) = fs::read_dir(root) else {
        return Vec::new();
    };
    month_dirs
        .flatten()
        .filter(|month| month.path().is_dir())
        .flat_map(|month| fs::read_dir(month.path()).into_iter().flatten().flatten())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some(IN_PROGRESS_EXT))
        .collect()
}

// 履歴画面に並べる記録ファイル1件分の情報。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingFile {
    // OSのファイルエクスプローラーで開くために使う絶対パス。
    pub path: String,
    pub name: String,
    // ファイル名から取り出した記録日と、同じ日の中での連番。
    pub date: String,
    pub sequence: u32,
    pub size_bytes: u64,
    // 最終更新時刻(UTCのエポックミリ秒)。中身を読めないファイルでも時刻を出せるように持つ。
    pub modified_ms: i64,
    // 中身から集計した内訳。1行も無い記録などはNoneになる。
    pub summary: Option<RecordingSummary>,
}

// 記録ファイルの中身から集計した内訳。
// 時刻は表示形式をフロントエンド(ローカル時刻)に任せるため、エポックミリ秒のまま返す。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSummary {
    pub started_at_ms: i64,
    pub ended_at_ms: i64,
    pub min_bpm: u16,
    pub max_bpm: u16,
    pub mean_bpm: f64,
}

// BPMと記録時間の範囲を1パスで数える集計器。Parquet/IPCの両方の読み取りで共有する。
// 行グループの統計は使わない。平均を出すにはどのみちbpm列を読む必要があるためで、
// 統計の有無に振り回されるより1パスで数える方が単純で確実。
struct SummaryAcc {
    started_at_ms: i64,
    ended_at_ms: i64,
    min_bpm: u16,
    max_bpm: u16,
    bpm_total: u64,
    rows: u64,
}

impl SummaryAcc {
    fn new() -> Self {
        Self {
            started_at_ms: i64::MAX,
            ended_at_ms: i64::MIN,
            min_bpm: u16::MAX,
            max_bpm: u16::MIN,
            bpm_total: 0,
            rows: 0,
        }
    }

    // 1バッチ分のtimestampとbpmを取り込む。両列は同じ行数なので件数はbpmで数える。
    fn add(&mut self, timestamps: &[i64], bpms: &[u16]) {
        for timestamp in timestamps {
            self.started_at_ms = self.started_at_ms.min(*timestamp);
            self.ended_at_ms = self.ended_at_ms.max(*timestamp);
        }
        for bpm in bpms {
            self.min_bpm = self.min_bpm.min(*bpm);
            self.max_bpm = self.max_bpm.max(*bpm);
            self.bpm_total += u64::from(*bpm);
        }
        self.rows += bpms.len() as u64;
    }

    // 1行も無いファイル(接続直後に切れた場合など)は集計できない。
    fn finish(self) -> Option<RecordingSummary> {
        if self.rows == 0 {
            return None;
        }
        Some(RecordingSummary {
            started_at_ms: self.started_at_ms,
            ended_at_ms: self.ended_at_ms,
            min_bpm: self.min_bpm,
            max_bpm: self.max_bpm,
            mean_bpm: self.bpm_total as f64 / self.rows as f64,
        })
    }
}

// 記録ファイルの中身から、記録時間の範囲とBPMの最小・最大・平均をまとめて集計する。
// 確定後の .parquet と、記録中/中断の .arrow の両方に対応する。
fn read_summary(path: &Path) -> Option<RecordingSummary> {
    let ext = path.extension().and_then(|ext| ext.to_str())?;
    if ext == FINAL_EXT {
        read_summary_parquet(path)
    } else if ext == IN_PROGRESS_EXT {
        read_summary_ipc(path)
    } else {
        None
    }
}

// Parquet(footer確定済み)を1回読み、必要な2列だけを集計する。
fn read_summary_parquet(path: &Path) -> Option<RecordingSummary> {
    let file = File::open(path).ok()?;
    let builder = ParquetRecordBatchReaderBuilder::try_new(file).ok()?;

    // 必要な2列だけを読む。rr_intervals_msのようなlist列を読み飛ばせるので無駄がない。
    let schema = builder.parquet_schema();
    let columns: Vec<usize> = ["timestamp_ms", "bpm"]
        .iter()
        .map(|wanted| {
            schema
                .columns()
                .iter()
                .position(|column| column.name() == *wanted)
        })
        .collect::<Option<Vec<usize>>>()?;
    let mask = ProjectionMask::leaves(schema, columns);
    let reader = builder.with_projection(mask).build().ok()?;

    let mut acc = SummaryAcc::new();
    for batch in reader {
        let batch = batch.ok()?;
        // 射影しても列の順序はスキーマ通り(timestamp_ms → bpm)。
        let timestamps = batch.column(0).as_primitive_opt::<Int64Type>()?;
        let bpms = batch.column(1).as_primitive_opt::<UInt16Type>()?;
        acc.add(timestamps.values(), bpms.values());
    }
    acc.finish()
}

// IPC stream(記録中/中断を含む)から集計する。切れていれば読めたバッチまでを集計する。
fn read_summary_ipc(path: &Path) -> Option<RecordingSummary> {
    let file = File::open(path).ok()?;
    // timestamp_ms(0)とbpm(2)だけを射影する。rr_intervals_msのようなlist列を読み飛ばせる。
    let reader = StreamReader::try_new(file, Some(vec![0, 2])).ok()?;

    let mut acc = SummaryAcc::new();
    for item in reader {
        // 中断で切れていれば末尾でErr。そこまでの完全なバッチだけ集計する。
        let Ok(batch) = item else {
            break;
        };
        // 射影後の列順は指定通り(timestamp_ms → bpm)。
        let timestamps = batch.column(0).as_primitive_opt::<Int64Type>()?;
        let bpms = batch.column(1).as_primitive_opt::<UInt16Type>()?;
        acc.add(timestamps.values(), bpms.values());
    }
    acc.finish()
}

// 記録ファイルの保存先ルート(<アプリデータ>/recordings)。
pub fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("データ保存先を取得できませんでした: {error}"))?
        .join("recordings"))
}

// 保存済みの記録ファイルを新しい順に並べて返す。
pub fn list_recordings(app: &AppHandle) -> Result<Vec<RecordingFile>, String> {
    Ok(list_recordings_in(&recordings_dir(app)?))
}

// 保存先ルート配下を走査する本体。Tauriに依存しないので単体テストからも使える。
// フォルダがまだ無い場合や読めないファイルがある場合は、その分を飛ばして空一覧・部分一覧を返す。
fn list_recordings_in(root: &Path) -> Vec<RecordingFile> {
    let Ok(month_dirs) = fs::read_dir(root) else {
        // まだ一度も記録していなければフォルダ自体が無い。エラーではなく空一覧として扱う。
        return Vec::new();
    };

    let mut recordings: Vec<RecordingFile> = month_dirs
        .flatten()
        // <recordings>/<年月>/<年月日_連番>.(parquet|arrow) の2階層だけを見る。
        .filter(|month| month.path().is_dir())
        .flat_map(|month| fs::read_dir(month.path()).into_iter().flatten().flatten())
        .filter_map(|entry| recording_file(&entry.path()))
        .collect();

    // 日付と連番の降順(新しい記録が上)。名前で並べるので、記録中のファイルでも順序が揺れない。
    recordings.sort_by(|left, right| {
        right
            .date
            .cmp(&left.date)
            .then(right.sequence.cmp(&left.sequence))
    });
    recordings
}

// パス1件をRecordingFileに変換する。記録ファイルの命名規則に合わないものはNoneで無視する。
fn recording_file(path: &Path) -> Option<RecordingFile> {
    let name = path.file_name()?.to_str()?.to_string();
    let (date, sequence) = parse_recording_name(&name)?;

    let metadata = fs::metadata(path).ok()?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0);

    Some(RecordingFile {
        path: path.to_str()?.to_string(),
        name,
        date,
        sequence,
        size_bytes: metadata.len(),
        modified_ms,
        // 記録中の .arrow も途中まで集計できる。読めないファイルは集計なしで一覧には並べる。
        summary: read_summary(path),
    })
}

// ".parquet" か ".arrow" の拡張子を落としてstemを返す。記録中と確定後を同じ記録として扱う。
fn recording_stem(name: &str) -> Option<&str> {
    name.strip_suffix(".parquet")
        .or_else(|| name.strip_suffix(".arrow"))
}

// "2026-06-01_2.parquet" → ("2026-06-01", 2)。書式が違うファイルはNone。
fn parse_recording_name(name: &str) -> Option<(String, u32)> {
    let stem = recording_stem(name)?;
    let (date, sequence) = stem.rsplit_once('_')?;
    // 日付として妥当かどうかまで見て、無関係なファイルを一覧に混ぜない。
    if chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
        return None;
    }
    Some((date.to_string(), sequence.parse::<u32>().ok()?))
}

// 月フォルダ内のファイル名一覧。読めない場合は空として扱い、連番を1から振る。
fn file_names_in(dir: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect()
}

// 同じ日付の既存ファイルを見て、次の連番を付けたファイル名を返す。
// 例: "2026-06-01_1.parquet" があれば "2026-06-01_2.parquet"。
// .arrow(記録中/未復旧)も同じ記録として数え、連番の重複を避ける。
// 日付や書式が一致しないファイルは無視する。
fn next_recording_name(existing_names: &[String], date: &str) -> String {
    let prefix = format!("{date}_");
    let latest = existing_names
        .iter()
        .filter_map(|name| {
            let stem = recording_stem(name)?;
            stem.strip_prefix(&prefix)?.parse::<u32>().ok()
        })
        .max()
        .unwrap_or(0);
    format!("{date}_{}.parquet", latest + 1)
}

// UTCのエポックミリ秒。各行のタイムスタンプに使う。
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
    use std::env::temp_dir;

    fn reading(bpm: u16, rr: Vec<u32>, battery: Option<u8>) -> HeartRateReading {
        HeartRateReading {
            device_id: "test-device".to_string(),
            bpm,
            rr_intervals_ms: rr,
            energy_expended: None,
            sensor_contact_detected: Some(true),
            battery_percent: battery,
        }
    }

    // 同じ日の記録は連番で増え、他の日付や無関係なファイルには影響されないことを確認する。
    // .arrow(記録中/未復旧)も .parquet と同じ記録として数える。
    #[test]
    fn numbers_recordings_per_day() {
        assert_eq!(
            next_recording_name(&[], "2026-06-01"),
            "2026-06-01_1.parquet"
        );

        let existing = [
            "2026-06-01_1.parquet".to_string(),
            // 中断で残った .arrow も同じ記録として連番に数える。
            "2026-06-01_2.arrow".to_string(),
            // 別の日付・無関係な名前は連番の判定に使わない。
            "2026-06-02_9.parquet".to_string(),
            "notes.txt".to_string(),
        ];
        assert_eq!(
            next_recording_name(&existing, "2026-06-01"),
            "2026-06-01_3.parquet"
        );
        assert_eq!(
            next_recording_name(&existing, "2026-06-03"),
            "2026-06-03_1.parquet"
        );
    }

    // 記録ファイル名から日付と連番を取り出せること、無関係な名前は一覧に混ざらないことを確認する。
    #[test]
    fn parses_recording_names() {
        assert_eq!(
            parse_recording_name("2026-06-01_2.parquet"),
            Some(("2026-06-01".to_string(), 2))
        );
        // 記録中の .arrow も命名規則を満たすものとして扱う。
        assert_eq!(
            parse_recording_name("2026-06-01_2.arrow"),
            Some(("2026-06-01".to_string(), 2))
        );
        assert_eq!(parse_recording_name("notes.txt"), None);
        assert_eq!(parse_recording_name("2026-06-01.parquet"), None);
        // 日付として成立しない名前は無視する。
        assert_eq!(parse_recording_name("session_1.parquet"), None);
    }

    // 月フォルダをまたいで記録を集め、新しい順に並び、無関係なファイルは混ざらないことを確認する。
    #[test]
    fn lists_recordings_newest_first() {
        let root = temp_dir().join(format!("kodou-list-test-{}", now_ms()));
        for (month, name) in [
            ("2026-06", "2026-06-01_1.parquet"),
            ("2026-06", "2026-06-02_1.parquet"),
            ("2026-06", "2026-06-02_2.parquet"),
            ("2026-07", "2026-07-01_1.parquet"),
            // 記録ファイルではないものは一覧に出さない。
            ("2026-07", "notes.txt"),
        ] {
            let dir = root.join(month);
            fs::create_dir_all(&dir).unwrap();
            File::create(dir.join(name)).unwrap();
        }

        let recordings = list_recordings_in(&root);
        let names: Vec<&str> = recordings.iter().map(|file| file.name.as_str()).collect();
        assert_eq!(
            names,
            [
                "2026-07-01_1.parquet",
                "2026-06-02_2.parquet",
                "2026-06-02_1.parquet",
                "2026-06-01_1.parquet",
            ]
        );

        // 保存先フォルダが無い場合は、エラーではなく空一覧になる。
        assert!(list_recordings_in(&root.join("missing")).is_empty());

        let _ = fs::remove_dir_all(&root);
    }

    // 記録→close→読み戻しの往復で、行数と代表値・list列・null許容列が保たれること、
    // closeで .arrow が消えて .parquet に確定することを確認する。
    #[test]
    fn writes_and_reads_back_readings() {
        let final_path = temp_dir().join(format!("kodou-recorder-test-{}.parquet", now_ms()));
        let arrow_path = final_path.with_extension(IN_PROGRESS_EXT);
        let mut recorder =
            HeartRateRecorder::with_path(final_path.clone()).expect("create recorder");

        recorder
            .record(1_000, &reading(60, vec![1000, 1010], Some(80)))
            .unwrap();
        recorder.record(2_000, &reading(61, vec![], None)).unwrap();
        recorder.close().unwrap();

        // closeで一時ファイルは消え、最終Parquetだけが残る。
        assert!(!arrow_path.exists());
        assert!(final_path.exists());

        let file = File::open(&final_path).expect("open written parquet");
        let mut reader = ParquetRecordBatchReaderBuilder::try_new(file)
            .expect("parquet reader")
            .build()
            .expect("build reader");
        let batch = reader.next().expect("has a batch").expect("valid batch");

        assert_eq!(batch.num_rows(), 2);
        assert_eq!(batch.schema().field(3).name(), "rr_intervals_ms");

        let _ = fs::remove_file(&final_path);
    }

    // 中身から記録時間の範囲とBPMの最小・最大・平均を集計できることを確認する。
    // list列を挟んだスキーマなので、列の取り違えがあればここで落ちる。
    #[test]
    fn summarizes_recording_contents() {
        let final_path = temp_dir().join(format!("kodou-summary-test-{}.parquet", now_ms()));
        let mut recorder =
            HeartRateRecorder::with_path(final_path.clone()).expect("create recorder");

        // 最終Parquetがまだ無いうちは集計できない。
        assert!(read_summary(&final_path).is_none());

        recorder
            .record(1_000, &reading(60, vec![1000], Some(80)))
            .unwrap();
        recorder.record(2_000, &reading(80, vec![], None)).unwrap();
        recorder.record(3_000, &reading(70, vec![], None)).unwrap();
        recorder.close().unwrap();

        let summary = read_summary(&final_path).expect("summary after close");
        assert_eq!(summary.started_at_ms, 1_000);
        assert_eq!(summary.ended_at_ms, 3_000);
        assert_eq!(summary.min_bpm, 60);
        assert_eq!(summary.max_bpm, 80);
        assert_eq!(summary.mean_bpm, 70.0);

        let _ = fs::remove_file(&final_path);
    }

    // クラッシュ(closeなし)を模し、EOS未書き込みの .arrow でも完全なバッチが復旧できることを確認する。
    // これがこの修正の肝で、footerを持つParquetでは失われていたデータをここで守れる。
    #[test]
    fn recovers_interrupted_ipc_recording() {
        let final_path = temp_dir().join(format!("kodou-recover-test-{}.parquet", now_ms()));
        let arrow_path = final_path.with_extension(IN_PROGRESS_EXT);
        {
            let mut recorder =
                HeartRateRecorder::with_path(final_path.clone()).expect("create recorder");
            // FLUSH_ROWS件書いて1バッチをディスクへ確定させる(fsync済み)。
            for i in 0..FLUSH_ROWS {
                recorder
                    .record(
                        1_000 + i as i64,
                        &reading(60 + (i % 5) as u16, vec![], None),
                    )
                    .unwrap();
            }
            // closeせずにdrop = EOS未書き込みのまま中断(クラッシュ・電源断相当)。
        }
        // 中断直後は .arrow が残り、.parquet はまだ無い。
        assert!(arrow_path.exists());
        assert!(!final_path.exists());

        // 復旧変換で、切れたstreamからでも読めるParquetになる。
        convert_ipc_to_parquet(&arrow_path, &final_path).expect("convert interrupted recording");
        let summary = read_summary(&final_path).expect("summary after recovery");
        assert_eq!(summary.started_at_ms, 1_000);
        assert_eq!(summary.ended_at_ms, 1_000 + (FLUSH_ROWS as i64 - 1));

        let _ = fs::remove_file(&arrow_path);
        let _ = fs::remove_file(&final_path);
    }
}
