use serde::Deserialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// config.conf の osc セクション。
/// ユーザーがアプリデータディレクトリに HOCON 形式で配置する。
///
/// ```hocon
/// osc {
///   targets = [
///     "127.0.0.1:9000",
///     "192.168.1.100:9000"
///   ]
/// }
/// ```
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
struct OscConfig {
    /// OSC送信先の "ip:port" 配列。空ならGUI設定を使う。
    targets: Vec<String>,
}

/// config.conf のパスを返す。アプリデータディレクトリ直下。
pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("データ保存先を取得できませんでした: {e}"))?;
    Ok(dir.join("config.conf"))
}

/// config.conf に書かれた OSC 送信先をフロントエンドへ返す。
/// フロントエンドはこれとGUIの送信先を統合して configure_osc を呼ぶ。
#[tauri::command]
pub fn get_config_osc_targets(app: AppHandle) -> Vec<String> {
    load_osc_targets(&app)
}

/// config.conf から OSC 送信先配列を読み込む。
/// ファイルが存在しない・壊れている場合は空ベクタを返し、GUI設定のみで動作させる。
fn load_osc_targets(app: &AppHandle) -> Vec<String> {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    if !path.exists() {
        return Vec::new();
    }

    match std::fs::read_to_string(&path) {
        Ok(text) => parse_osc_targets(&text),
        Err(error) => {
            eprintln!("config.conf を読み込めませんでした: {error}");
            Vec::new()
        }
    }
}

/// HOCON文字列から osc.targets を取り出す。
/// osc セクションが無い・型が違うといった場合は空ベクタを返し、設定ミスでアプリを止めない。
fn parse_osc_targets(text: &str) -> Vec<String> {
    let config = match hocon::parse(text) {
        Ok(config) => config,
        Err(error) => {
            eprintln!("config.conf の解析に失敗しました: {error}");
            return Vec::new();
        }
    };

    // osc セクションをサブオブジェクトとして取り出し、serde で構造体へ変換する。
    match config.get_config("osc") {
        Ok(osc_config) => osc_config
            .deserialize::<OscConfig>()
            .map(|c| c.targets)
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// 初回起動時に生成する config.conf のテンプレート。
const CONFIG_TEMPLATE: &str = r#"// Kodou 設定ファイル (HOCON形式)
// 複数のOSC送信先を配列で指定できます。
// ここに書いた送信先は、GUIの送信先設定と統合して使われます。

osc {
  targets = [
    "127.0.0.1:9000"
  ]
}
"#;

/// config.conf が存在しない場合、デフォルトのテンプレートを生成する。
/// 既存ファイルは上書きしない。
pub fn ensure_config_template(app: &AppHandle) {
    let path = match config_path(app) {
        Ok(p) => p,
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
    fn parses_targets_from_osc_section() {
        let text = r#"
osc {
  targets = [
    "127.0.0.1:9000",
    "192.168.1.100:9001"
  ]
}
"#;
        assert_eq!(
            parse_osc_targets(text),
            vec!["127.0.0.1:9000", "192.168.1.100:9001"]
        );
    }

    #[test]
    fn shipped_template_parses_to_default_target() {
        assert_eq!(parse_osc_targets(CONFIG_TEMPLATE), vec!["127.0.0.1:9000"]);
    }

    #[test]
    fn returns_empty_for_missing_section_or_broken_syntax() {
        assert!(parse_osc_targets("other { key = 1 }").is_empty());
        assert!(parse_osc_targets("osc { targets = [").is_empty());
    }
}
