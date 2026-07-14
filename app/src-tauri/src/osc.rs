use rosc::{encoder, OscMessage, OscPacket, OscType};
use serde::Deserialize;
use std::net::{SocketAddr, UdpSocket};
use std::sync::Mutex;
use tauri::State;

/// OSC送信状態。config.confの配列で複数の送信先を指定できるほか、
/// フロントエンドから動的に追加することも可能。
#[derive(Default)]
pub struct OscState {
    /// 送信用UDPソケット。最初の送信先設定時にbindし、以降は再利用する。
    socket: Mutex<Option<UdpSocket>>,
    /// 送信先アドレスのリスト。空なら送信しない。
    targets: Mutex<Vec<SocketAddr>>,
}

/// フロントエンドから受け取るOSCメッセージ1件。
/// VRChatへ送るKodou標準パラメータはいずれも単一の引数なので、argsは1つだけ扱う。
#[derive(Deserialize)]
pub struct OscMessageArg {
    pub address: String,
    pub arg: OscArg,
}

/// OSCの型はbool/int/floatの3種類だけで表現できるため、
/// serdeのtag/contentでJS側から `{ kind: "Int", value: 80 }` のように送らせる。
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value")]
pub enum OscArg {
    Bool(bool),
    Int(i64),
    Float(f64),
}

fn arg_to_osc(arg: OscArg) -> OscType {
    match arg {
        OscArg::Bool(v) => OscType::Bool(v),
        // OSCのint型は32bitなので、フロントエンドから来たi64を安全な範囲に丸める。
        OscArg::Int(v) => OscType::Int(v.clamp(i32::MIN as i64, i32::MAX as i64) as i32),
        OscArg::Float(v) => OscType::Float(v as f32),
    }
}

fn encode(message: OscMessageArg) -> Result<Vec<u8>, String> {
    let osc_msg = OscMessage {
        addr: message.address,
        args: vec![arg_to_osc(message.arg)],
    };
    encoder::encode(&OscPacket::Message(osc_msg))
        .map_err(|e| format!("OSCメッセージをエンコードできませんでした: {e}"))
}

/// 送信先リストを設定する。空配列を渡すと送信を停止する。
/// フロントエンドがconfig.confのtargetsとGUIの送信先を統合した結果を渡してくる。
#[tauri::command]
pub fn configure_osc(state: State<'_, OscState>, targets: Vec<String>) -> Result<(), String> {
    let mut targets_guard = state
        .targets
        .lock()
        .map_err(|_| "OSCの送信先ロックを取得できませんでした".to_string())?;

    let mut addresses = Vec::with_capacity(targets.len());
    for target_str in &targets {
        let address: SocketAddr = target_str
            .parse()
            .map_err(|_| format!("OSCの送信先を解析できませんでした: {target_str}"))?;
        addresses.push(address);
    }
    *targets_guard = addresses;

    // 送信先が1つでもあればソケットを用意し、空なら閉じる。
    let mut socket_guard = state
        .socket
        .lock()
        .map_err(|_| "OSCのソケットロックを取得できませんでした".to_string())?;

    if targets_guard.is_empty() {
        *socket_guard = None;
    } else if socket_guard.is_none() {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("OSC送信用ソケットを作成できませんでした: {e}"))?;
        *socket_guard = Some(socket);
    }

    Ok(())
}

/// 複数のOSCメッセージを、設定された全ての送信先へ一括で送る。
/// 送信先未設定時は何もせず成功扱いにし、設定UIの操作を妨げない。
#[tauri::command]
pub fn send_osc(state: State<'_, OscState>, messages: Vec<OscMessageArg>) -> Result<(), String> {
    let addresses = state
        .targets
        .lock()
        .map_err(|_| "OSCの送信先ロックを取得できませんでした".to_string())?
        .clone();

    if addresses.is_empty() {
        return Ok(());
    }

    let socket_guard = state
        .socket
        .lock()
        .map_err(|_| "OSCのソケットロックを取得できませんでした".to_string())?;
    let Some(socket) = socket_guard.as_ref() else {
        return Ok(());
    };

    for message in messages {
        match encode(message) {
            Ok(bytes) => {
                // 全ての送信先へ送る。1つの送信先への失敗で全体は止めない。
                for address in &addresses {
                    let _ = socket.send_to(&bytes, address);
                }
            }
            Err(error) => {
                return Err(error);
            }
        }
    }

    Ok(())
}
