use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// config.conf の osc セクション。送信先と、OSC値を計算するための数値設定を持つ。
/// 各キーが省略された場合は既定値を使う。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct OscSettings {
    /// OSC送信先の "ip:port" 配列。空なら送信しない。
    pub targets: Vec<String>,
    /// HRNormalised / HRFloat の正規化に使うBPMの下限・上限。
    pub bpm_min: i64,
    pub bpm_max: i64,
    /// HRFloat を -1.0〜1.0 で送るか("signed")、0.0〜1.0 で送るか("unsigned")。
    pub hr_float_mode: String,
    /// HRAverage の平均窓(ms)。
    pub average_window_ms: u64,
    /// BeatPulse を true にしてから false へ戻すまでの時間(ms)。
    pub beat_pulse_ms: u64,
    /// RRTwitchUp / RRTwitchDown を発火させる RR 間隔差のしきい値(ms)。
    pub rr_twitch_threshold_ms: u64,
}

impl Default for OscSettings {
    fn default() -> Self {
        Self {
            targets: vec!["127.0.0.1:9000".to_string()],
            bpm_min: 0,
            bpm_max: 240,
            hr_float_mode: "signed".to_string(),
            average_window_ms: 10_000,
            beat_pulse_ms: 120,
            rr_twitch_threshold_ms: 50,
        }
    }
}

/// パラメータ名 → 送信先OSCアドレスの配列。
/// 空配列にするとそのパラメータは送信しない。
/// 順序を安定させてフロントエンドの表示がぶれないよう BTreeMap を使う。
pub type CompatibilityMap = BTreeMap<String, Vec<String>>;

/// フロントエンドへ返す設定一式。
#[derive(Debug, Clone, Serialize, Default)]
pub struct AppConfig {
    pub osc: OscSettings,
    pub compatibility: CompatibilityMap,
}

/// compatibility セクションの既定値。VRCOSC のアドレスを基本とし、
/// VRCOSC に対応するものが無いパラメータは Kodou 標準アドレスへ送る。
///
/// BeatToggle と BeatPulse は VRCOSC ではどちらも `Beat` に対応するため、
/// 同じアドレスへ両方送ると競合する。既定では BeatToggle のみ有効にする。
fn default_compatibility() -> CompatibilityMap {
    let entries: [(&str, &[&str]); 14] = [
        (
            "connected",
            &["/avatar/parameters/VRCOSC/Heartrate/Connected"],
        ),
        ("reconnecting", &["/avatar/parameters/Kodou/Reconnecting"]),
        ("hr", &["/avatar/parameters/VRCOSC/Heartrate/Value"]),
        ("hrFloat", &["/avatar/parameters/Kodou/HRFloat"]),
        (
            "hrNormalised",
            &["/avatar/parameters/VRCOSC/Heartrate/Normalised"],
        ),
        (
            "hrAverage",
            &["/avatar/parameters/VRCOSC/Heartrate/Average"],
        ),
        ("battery", &["/avatar/parameters/Kodou/Battery"]),
        ("batteryFloat", &["/avatar/parameters/Kodou/BatteryFloat"]),
        ("beatToggle", &["/avatar/parameters/VRCOSC/Heartrate/Beat"]),
        ("beatPulse", &[]),
        ("rrInterval", &["/avatar/parameters/Kodou/RRInterval"]),
        ("rrTwitchUp", &[]),
        ("rrTwitchDown", &[]),
        ("activity", &[]),
    ];

    entries
        .iter()
        .map(|(key, addresses)| {
            (
                (*key).to_string(),
                addresses.iter().map(|a| (*a).to_string()).collect(),
            )
        })
        .collect()
}

/// config.conf のパスを返す。アプリデータディレクトリ直下。
pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("データ保存先を取得できませんでした: {e}"))?;
    Ok(dir.join("config.conf"))
}

/// config.conf を読み込んでフロントエンドへ返す。
/// ファイルが無い・壊れている場合は既定値を返し、設定ミスでアプリを止めない。
#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    load_config(&app)
}

fn load_config(app: &AppHandle) -> AppConfig {
    let path = match config_path(app) {
        Ok(path) => path,
        Err(_) => return AppConfig::default_with_compatibility(),
    };

    match std::fs::read_to_string(&path) {
        Ok(text) => parse_config(&text),
        Err(_) => AppConfig::default_with_compatibility(),
    }
}

impl AppConfig {
    /// 設定ファイルが無いときに使う既定設定。
    fn default_with_compatibility() -> Self {
        Self {
            osc: OscSettings::default(),
            compatibility: default_compatibility(),
        }
    }
}

/// HOCON文字列から設定を取り出す。
///
/// セクションごとに独立して既定値へフォールバックする。
/// とくに compatibility セクションが無い設定ファイル（送信先だけを書いた旧版など）では
/// 既定のアドレス表を使う。ここで空表を返すと、全パラメータが無言で送信されなくなる。
fn parse_config(text: &str) -> AppConfig {
    let config = match hocon::parse(text) {
        Ok(config) => config,
        Err(error) => {
            eprintln!("config.conf の解析に失敗しました: {error}");
            return AppConfig::default_with_compatibility();
        }
    };

    let osc = config
        .get_config("osc")
        .ok()
        .and_then(|section| section.deserialize::<OscSettings>().ok())
        .unwrap_or_default();

    let compatibility = config
        .get_config("compatibility")
        .ok()
        .and_then(|section| section.deserialize::<CompatibilityMap>().ok())
        .unwrap_or_else(default_compatibility);

    AppConfig { osc, compatibility }
}

/// 初回起動時に生成する config.conf のテンプレート。
/// compatibility は全パラメータを列挙する。ここに書いたものだけが送信されるため、
/// 利用者はこのファイルを編集するだけで送信内容を決められる。
const CONFIG_TEMPLATE: &str = r#"// Kodou 設定ファイル (HOCON形式)
// 編集後はアプリを再起動すると反映されます。

osc {
  // OSC送信先。複数書くと、すべての送信先へ同じ値を送ります。
  // VRChat は通常 127.0.0.1:9000 で待ち受けます。
  targets = [
    "127.0.0.1:9000"
  ]

  // HRNormalised / HRFloat を計算するときのBPMの下限・上限。
  bpmMin = 0
  bpmMax = 240

  // HRFloat の範囲。"signed" は -1.0〜1.0、"unsigned" は 0.0〜1.0。
  hrFloatMode = "signed"

  // HRAverage の平均窓 (ms)。
  averageWindowMs = 10000

  // BeatPulse を true にしてから false へ戻すまでの時間 (ms)。
  beatPulseMs = 120

  // RRTwitchUp / RRTwitchDown を発火させる RR 間隔差のしきい値 (ms)。
  rrTwitchThresholdMs = 50
}

// パラメータ名 = 送信するOSCアドレスの配列。
// 空配列にすると、そのパラメータは送信しません。
// 既定値は VRCOSC 互換のアドレスで、VRCOSC に対応するものが無いパラメータは
// Kodou 標準アドレス (/avatar/parameters/Kodou/...) を使います。
compatibility {
  connected    = ["/avatar/parameters/VRCOSC/Heartrate/Connected"]
  reconnecting = ["/avatar/parameters/Kodou/Reconnecting"]
  hr           = ["/avatar/parameters/VRCOSC/Heartrate/Value"]
  hrFloat      = ["/avatar/parameters/Kodou/HRFloat"]
  hrNormalised = ["/avatar/parameters/VRCOSC/Heartrate/Normalised"]
  hrAverage    = ["/avatar/parameters/VRCOSC/Heartrate/Average"]
  battery      = ["/avatar/parameters/Kodou/Battery"]
  batteryFloat = ["/avatar/parameters/Kodou/BatteryFloat"]

  // BeatToggle は拍ごとに true/false を反転、BeatPulse は拍ごとに短時間だけ true。
  // VRCOSC ではどちらも Beat に対応するため、同じアドレスへ両方送ると競合します。
  beatToggle   = ["/avatar/parameters/VRCOSC/Heartrate/Beat"]
  beatPulse    = []

  rrInterval   = ["/avatar/parameters/Kodou/RRInterval"]

  // 以下は既定で無効。使う場合はアドレスを書いてください。
  // rrTwitchUp   = ["/avatar/parameters/Kodou/RRTwitchUp"]
  // rrTwitchDown = ["/avatar/parameters/Kodou/RRTwitchDown"]
  rrTwitchUp   = []
  rrTwitchDown = []
  activity     = []
}
"#;

/// config.conf が存在しない場合、デフォルトのテンプレートを生成する。
/// 既存ファイルは上書きしない。
pub fn ensure_config_template(app: &AppHandle) {
    let path = match config_path(app) {
        Ok(path) => path,
        Err(_) => return,
    };

    if path.exists() {
        return;
    }

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&path, CONFIG_TEMPLATE);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_osc_section() {
        let text = r#"
osc {
  targets = ["127.0.0.1:9000", "192.168.1.100:9001"]
  bpmMax = 200
  beatPulseMs = 80
}
"#;
        let config = parse_config(text);
        assert_eq!(config.osc.targets, ["127.0.0.1:9000", "192.168.1.100:9001"]);
        assert_eq!(config.osc.bpm_max, 200);
        assert_eq!(config.osc.beat_pulse_ms, 80);
        // 省略したキーは既定値のまま。
        assert_eq!(config.osc.bpm_min, 0);
        assert_eq!(config.osc.average_window_ms, 10_000);
    }

    #[test]
    fn compatibility_section_is_authoritative_when_present() {
        let text = r#"
compatibility {
  hr = ["/avatar/parameters/Kodou/HR", "/avatar/parameters/VRCOSC/Heartrate/Value"]
  connected = []
}
"#;
        let config = parse_config(text);
        assert_eq!(config.compatibility.get("hr").unwrap().len(), 2);
        assert!(config.compatibility.get("connected").unwrap().is_empty());
        // 書かれていないパラメータは送信対象外になる。
        assert!(!config.compatibility.contains_key("battery"));
    }

    // compatibility セクションを持たない旧版の config.conf でも、
    // 既定のアドレス表へフォールバックして送信が止まらないことを確認する。
    #[test]
    fn missing_compatibility_section_falls_back_to_defaults() {
        let config = parse_config("osc { targets = [\"127.0.0.1:9000\"] }");
        assert_eq!(config.compatibility, default_compatibility());
        assert_eq!(
            config.compatibility.get("hr").unwrap(),
            &["/avatar/parameters/VRCOSC/Heartrate/Value"]
        );
    }

    // テンプレートと Rust 側の既定値がずれると、UI表示と実際の送信内容が食い違う。
    #[test]
    fn shipped_template_matches_defaults() {
        let config = parse_config(CONFIG_TEMPLATE);
        assert_eq!(config.osc.targets, OscSettings::default().targets);
        assert_eq!(config.osc.bpm_max, OscSettings::default().bpm_max);
        assert_eq!(config.compatibility, default_compatibility());
    }

    #[test]
    fn broken_syntax_falls_back_to_defaults() {
        let config = parse_config("osc { targets = [");
        assert_eq!(config.osc.targets, OscSettings::default().targets);
        assert_eq!(config.compatibility, default_compatibility());
    }
}
