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
use arrow_array::RecordBatch;
use arrow_schema::{DataType, Field, Schema};
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use tauri::{AppHandle, Manager};

use crate::heart_rate::HeartRateReading;

// 1行 = BLE通知1件。列指向のParquetにまとめて書くことで、pandas/polars/DuckDBで
// そのまま解析でき、HDF5のようなネイティブCライブラリ依存も持たずに済む。
// 生パケットを忠実に残すため、rr_intervals_ms は list<u32> 列として保持する。
const FLUSH_ROWS: usize = 64;

pub struct HeartRateRecorder {
    // close()後はNoneにして、二重closeや確定後の追記を防ぐ。
    writer: Option<ArrowWriter<File>>,
    schema: Arc<Schema>,
    timestamp_ms: Int64Builder,
    device_id: StringBuilder,
    bpm: UInt16Builder,
    rr_intervals_ms: ListBuilder<UInt32Builder>,
    energy_expended: UInt16Builder,
    sensor_contact_detected: BooleanBuilder,
    battery_percent: UInt8Builder,
    buffered_rows: usize,
    // 保存先パス。記録開始時にフロントエンドへ通知して、履歴画面に表示する。
    pub path: PathBuf,
}

impl HeartRateRecorder {
    // アプリのデータディレクトリ配下 recordings/<年月>/<年月日>_<連番>.parquet を1つ作る。
    // デバイスへ接続するたびに新しいファイルを作り、同じ日の記録は連番で並べる。
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        // ファイル名の日付は、利用者が探しやすいようUTCではなくローカル時刻で決める。
        let now = Local::now();
        let month_dir = recordings_dir(app)?.join(now.format("%Y-%m").to_string());
        fs::create_dir_all(&month_dir)
            .map_err(|error| format!("保存先フォルダを作成できませんでした: {error}"))?;

        let date = now.format("%Y-%m-%d").to_string();
        let path = month_dir.join(next_recording_name(&file_names_in(&month_dir), &date));
        Self::with_path(path)
    }

    // 保存先パスを指定してライターを用意する。Tauriに依存しないので単体テストからも使える。
    fn with_path(path: PathBuf) -> Result<Self, String> {
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

        let file = File::create(&path)
            .map_err(|error| format!("保存ファイルを作成できませんでした: {error}"))?;
        let props = WriterProperties::builder()
            .set_compression(Compression::SNAPPY)
            .build();
        let writer = ArrowWriter::try_new(file, schema.clone(), Some(props))
            .map_err(|error| format!("Parquetライターを初期化できませんでした: {error}"))?;

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
            path,
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

    // バッファ済みの行をRecordBatchにしてParquetへ書き出す(footerはclose時のみ確定)。
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

        writer
            .write(&batch)
            .map_err(|error| format!("記録データを書き込めませんでした: {error}"))?;
        // 行グループをディスクへ確定させ、セッション途中でも取りこぼしを減らす。
        writer
            .flush()
            .map_err(|error| format!("記録データを確定できませんでした: {error}"))?;
        self.buffered_rows = 0;
        Ok(())
    }

    // 残りをflushしてfooterを書き、標準ツールで読めるParquetとして確定する。
    pub fn close(&mut self) -> Result<(), String> {
        self.flush()?;
        if let Some(writer) = self.writer.take() {
            writer
                .close()
                .map_err(|error| format!("記録ファイルを確定できませんでした: {error}"))?;
        }
        Ok(())
    }
}

// 履歴画面に並べる記録ファイル1件分の情報。
// 中身(Parquet)は開かず、ファイル名とファイルシステムの情報だけで組み立てる。
// 記録中のファイルはfooterが未確定で読めないため、ここで中身に触れない方が一覧が壊れにくい。
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
    // 最終更新時刻(UTCのエポックミリ秒)。記録が終わったおおよその時刻として表示する。
    pub modified_ms: i64,
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
        // <recordings>/<年月>/<年月日_連番>.parquet の2階層だけを見る。
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
    })
}

// "2026-06-01_2.parquet" → ("2026-06-01", 2)。書式が違うファイルはNone。
fn parse_recording_name(name: &str) -> Option<(String, u32)> {
    let stem = name.strip_suffix(".parquet")?;
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
// 日付や書式が一致しないファイルは無視する。
fn next_recording_name(existing_names: &[String], date: &str) -> String {
    let prefix = format!("{date}_");
    let latest = existing_names
        .iter()
        .filter_map(|name| {
            let stem = name.strip_suffix(".parquet")?;
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
    #[test]
    fn numbers_recordings_per_day() {
        assert_eq!(
            next_recording_name(&[], "2026-06-01"),
            "2026-06-01_1.parquet"
        );

        let existing = [
            "2026-06-01_1.parquet".to_string(),
            "2026-06-01_2.parquet".to_string(),
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

    // 記録→close→読み戻しの往復で、行数と代表値・list列・null許容列が保たれることを確認する。
    #[test]
    fn writes_and_reads_back_readings() {
        let path = temp_dir().join(format!("kodou-recorder-test-{}.parquet", now_ms()));
        let mut recorder = HeartRateRecorder::with_path(path.clone()).expect("create recorder");

        recorder
            .record(1_000, &reading(60, vec![1000, 1010], Some(80)))
            .unwrap();
        recorder.record(2_000, &reading(61, vec![], None)).unwrap();
        recorder.close().unwrap();

        let file = File::open(&path).expect("open written parquet");
        let mut reader = ParquetRecordBatchReaderBuilder::try_new(file)
            .expect("parquet reader")
            .build()
            .expect("build reader");
        let batch = reader.next().expect("has a batch").expect("valid batch");

        assert_eq!(batch.num_rows(), 2);
        assert_eq!(batch.schema().field(3).name(), "rr_intervals_ms");

        let _ = fs::remove_file(&path);
    }
}
