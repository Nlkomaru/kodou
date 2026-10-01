import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSetAtom } from "jotai";
import { isTauriRuntime } from "@/lib/heart-rate";
import { loadLastDevice } from "@/lib/last-device";
import { loadMonitorStopped, loadStartupSettings, saveMonitorStopped, shouldAutoConnect } from "@/lib/startup";
import { errorAtom, selectedDeviceIdAtom, setDevicesAtom } from "@/state/heart-rate";

// 起動時の設定と前回の停止状態に従って、記憶した心拍センサーへ再接続する。
// Rust側のstart_heart_rate_monitorはID/アドレス/名前で自前スキャンするため、
// 事前のスキャン操作なしでデバイスIDだけ渡せばよい。
export function useAutoConnect() {
  const setDevices = useSetAtom(setDevicesAtom);
  const setSelectedDeviceId = useSetAtom(selectedDeviceIdAtom);
  const setError = useSetAtom(errorAtom);
  const attempted = useRef(false);

  useEffect(() => {
    // React StrictModeの二重マウントで接続を二回開始しないようにする。
    if (attempted.current) return;
    attempted.current = true;

    const lastDevice = loadLastDevice();
    if (!lastDevice) return;

    // スキャン前でもデバイス選択UIに前回のデバイスを表示できるようにする。
    setDevices([lastDevice]);
    setSelectedDeviceId(lastDevice.id);

    // 自動接続しない場合も、前回のデバイスは選択したまま手動接続できるようにする。
    if (!isTauriRuntime() || !shouldAutoConnect(loadStartupSettings(), loadMonitorStopped())) return;

    invoke("start_heart_rate_monitor", { deviceId: lastDevice.id })
      .then(() => saveMonitorStopped(false))
      .catch((autoConnectError) => {
        setError(String(autoConnectError));
      });
  }, [setDevices, setSelectedDeviceId, setError]);
}
