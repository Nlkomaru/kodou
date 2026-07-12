import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSetAtom } from "jotai";
import { isTauriRuntime } from "@/lib/heart-rate";
import { loadLastDevice } from "@/lib/last-device";
import { errorAtom, selectedDeviceIdAtom, setDevicesAtom } from "@/state/heart-rate";

// 起動時に前回接続した心拍センサーへ自動で再接続する。
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

    if (!isTauriRuntime()) return;

    invoke("start_heart_rate_monitor", { deviceId: lastDevice.id }).catch((autoConnectError) => {
      setError(String(autoConnectError));
    });
  }, [setDevices, setSelectedDeviceId, setError]);
}
