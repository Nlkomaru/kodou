use rosc::{encoder, OscMessage, OscPacket, OscType};
use serde::Deserialize;
use std::net::{SocketAddr, UdpSocket};
use std::sync::Mutex;
use tauri::State;

// VRChatのAvatar Parameter OSCは、通常 `127.0.0.1:9000` で待ち受ける。
// フロントエンドから明示的に設定されるまでは送信しないように、targetをOptionで持つ。
#[derive(Default)]
pub struct OscState {
    socket: Mutex<Option<UdpSocket>>,
    target: Mutex<Option<SocketAddr>>,
}

// フロントエンドから受け取るOSCメッセージ1件。
// VRChatへ送るKodou標準パラメータはいずれも単一の引数なので、argsは1つだけ扱う。
#[derive(Deserialize)]
pub struct OscMessageArg {
    pub address: String,
    pub arg: OscArg,
}

// OSCの型はbool/int/floatの3種類だけで表現できるため、
// serdeのtag/contentでJS側から `{ kind: "Int", value: 80 }` のように送らせる。
#[derive(Deserialize)]
#[serde(tag = "kind", content = "value")]
pub enum OscArg {
    Bool(bool),
    Int(i64),
    Float(f64),
}

fn arg_to_osc(arg: OscArg) -> OscType {
    match arg {
        OscArg::Bool(value) => OscType::Bool(value),
        // OSCのint型は32bitなので、前端から来たi64を安全な範囲に丸める。
        OscArg::Int(value) => OscType::Int(value.clamp(i32::MIN as i64, i32::MAX as i64) as i32),
        OscArg::Float(value) => OscType::Float(value as f32),
    }
}

fn encode(message: OscMessageArg) -> Result<Vec<u8>, String> {
    let packet = OscPacket::Message(OscMessage {
        addr: message.address,
        args: vec![arg_to_osc(message.arg)],
    });
    encoder::encode(&packet).map_err(|error| format!("OSCパケットのエンコードに失敗しました: {error}"))
}

// 送信先を設定する。Noneを渡すと送信を停止し、ソケットも閉じる。
// 既存のソケットがある場合はアドレス変更時も再利用し、bindし直さない。
#[tauri::command]
pub fn configure_osc(state: State<'_, OscState>, target: Option<String>) -> Result<(), String> {
    let mut target_guard = state
        .target
        .lock()
        .map_err(|_| "OSCの送信先ロックを取得できませんでした".to_string())?;

    match target {
        Some(target_str) => {
            let address: SocketAddr = target_str
                .parse()
                .map_err(|_| format!("OSCの送信先を解析できませんでした: {target_str}"))?;
            *target_guard = Some(address);

            let mut socket_guard = state
                .socket
                .lock()
                .map_err(|_| "OSCのソケットロックを取得できませんでした".to_string())?;
            if socket_guard.is_none() {
                let socket = UdpSocket::bind("0.0.0.0:0")
                    .map_err(|error| format!("OSC送信用ソケットを作成できませんでした: {error}"))?;
                *socket_guard = Some(socket);
            }
        }
        None => {
            *target_guard = None;
            if let Ok(mut socket_guard) = state.socket.lock() {
                *socket_guard = None;
            }
        }
    }

    Ok(())
}

// 複数のOSCメッセージを一括で送る。
// 心拍1件あたり10以上のパラメータを送るため、IPC呼び出し回数を減らすために配列で受け取る。
// target未設定時は何もせず成功扱いにし、設定UIの操作を妨げない。
#[tauri::command]
pub fn send_osc(state: State<'_, OscState>, messages: Vec<OscMessageArg>) -> Result<(), String> {
    let address = *state
        .target
        .lock()
        .map_err(|_| "OSCの送信先ロックを取得できませんでした".to_string())?;
    let Some(address) = address else {
        return Ok(());
    };

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
                // 1メッセージの送信失敗で全体を止めず、次のメッセージ送信を試みる。
                let _ = socket.send_to(&bytes, address);
            }
            Err(error) => {
                return Err(error);
            }
        }
    }

    Ok(())
}