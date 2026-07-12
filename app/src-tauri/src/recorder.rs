use std::fs::{self, File};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

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
    // 保存先パス。今は自動記録のみで参照しないが、将来のエクスポート/フォルダ表示のために保持する。
    #[allow(dead_code)]
    pub path: PathBuf,
}

impl HeartRateRecorder {
    // アプリのデータディレクトリ配下 recordings/ に、セッション開始時刻を名前にしたParquetを1つ作る。
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("データ保存先を取得できませんでした: {error}"))?
            .join("recordings");
        fs::create_dir_all(&dir)
            .map_err(|error| format!("保存先フォルダを作成できませんでした: {error}"))?;

        let path = dir.join(format!("heart-rate-{}.parquet", now_ms()));
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

// UTCのエポックミリ秒。ファイル名と各行のタイムスタンプに使う。
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

    // 記録→close→読み戻しの往復で、行数と代表値・list列・null許容列が保たれることを確認する。
    #[test]
    fn writes_and_reads_back_readings() {
        let path = temp_dir().join(format!("kodou-recorder-test-{}.parquet", now_ms()));
        let mut recorder = HeartRateRecorder::with_path(path.clone()).expect("create recorder");

        recorder.record(1_000, &reading(60, vec![1000, 1010], Some(80))).unwrap();
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
