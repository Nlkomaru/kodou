import { invoke } from "@tauri-apps/api/core";
import { useAtomValue, useSetAtom } from "jotai";
import { Bluetooth, Radio, Square } from "lucide-react";
import { Button } from "@fluentui/react-components";
import { isTauriRuntime } from "@/lib/heart-rate";
import { saveLastDevice } from "@/lib/last-device";
import { saveMonitorStopped } from "@/lib/startup";
import type { HeartRateDevice } from "@/lib/heart-rate-types";
import {
  clearReadingAtom,
  errorAtom,
  isScanningAtom,
  selectedDeviceAtom,
  selectedDeviceIdAtom,
  setDevicesAtom,
  statusAtom,
} from "@/state/heart-rate";

export function Controls() {
  const selectedDeviceId = useAtomValue(selectedDeviceIdAtom);
  const selectedDevice = useAtomValue(selectedDeviceAtom);
  const status = useAtomValue(statusAtom);
  const setDevices = useSetAtom(setDevicesAtom);
  const setError = useSetAtom(errorAtom);
  const setIsScanning = useSetAtom(isScanningAtom);
  const setStatus = useSetAtom(statusAtom);
  const clearReading = useSetAtom(clearReadingAtom);

  async function scanDevices() {
    if (!isTauriRuntime()) {
      setError("心拍センサーの検索は Tauri アプリ上で利用できます。");
      return;
    }

    setError("");
    setIsScanning(true);
    setStatus({
      state: "scanning",
      message: "Heart Rate Service (180D) を持つ BLE デバイスを検索しています。",
      deviceId: null,
    });

    try {
      const nextDevices = await invoke<HeartRateDevice[]>("scan_heart_rate_monitors", {
        scanSeconds: 8,
      });
      setDevices(nextDevices);
      setStatus({
        state: "disconnected",
        message:
          nextDevices.length > 0
            ? `${nextDevices.length} 件の心拍センサーが見つかりました。`
            : "心拍センサーは見つかりませんでした。",
        deviceId: null,
      });
    } catch (scanError) {
      setError(String(scanError));
      setStatus({
        state: "error",
        message: String(scanError),
        deviceId: null,
      });
    } finally {
      setIsScanning(false);
    }
  }

  async function startMonitor() {
    if (!selectedDeviceId) return;
    if (!isTauriRuntime()) {
      setError("心拍モニタリングは Tauri アプリ上で利用できます。");
      return;
    }

    setError("");
    clearReading();

    try {
      await invoke("start_heart_rate_monitor", {
        deviceId: selectedDeviceId,
      });
      // 開始が成功したときだけ停止状態を解除し、次回起動時に復元できるようにする。
      saveMonitorStopped(false);
      // 次回起動時の自動再接続先として、接続を開始できたデバイスを覚えておく。
      if (selectedDevice) {
        saveLastDevice(selectedDevice);
      }
    } catch (startError) {
      setError(String(startError));
    }
  }

  async function stopMonitor() {
    if (!isTauriRuntime()) {
      setError("心拍モニタリングは Tauri アプリ上で利用できます。");
      return;
    }

    setError("");
    try {
      await invoke("stop_heart_rate_monitor");
      // デバイスの記憶は残したまま停止を保存し、次回は設定に従って自動接続を抑止する。
      saveMonitorStopped(true);
      setStatus({
        state: "disconnected",
        message: "心拍モニタリングを停止しました。",
        deviceId: selectedDeviceId || null,
      });
    } catch (stopError) {
      setError(String(stopError));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        appearance="primary"
        size="large"
        icon={<Radio className="size-4" aria-hidden="true" />}
        onClick={scanDevices}
        disabled={status.state === "scanning" || status.state === "connecting"}
      >
        {status.state === "scanning" ? "検索中..." : "スキャン"}
      </Button>
      <Button
        appearance="primary"
        size="large"
        icon={<Bluetooth className="size-4" aria-hidden="true" />}
        onClick={startMonitor}
        disabled={!selectedDeviceId || status.state === "connecting" || status.state === "scanning"}
      >
        {status.state === "connecting" ? "接続中..." : status.state === "connected" ? "再接続" : "接続"}
      </Button>
      <Button
        appearance="secondary"
        size="large"
        icon={<Square className="size-4" aria-hidden="true" />}
        onClick={stopMonitor}
        disabled={!selectedDeviceId}
      >
        停止
      </Button>
    </div>
  );
}
