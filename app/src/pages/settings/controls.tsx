import { invoke } from "@tauri-apps/api/core";
import { useAtomValue, useSetAtom } from "jotai";
import { Bluetooth, Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauriRuntime } from "@/lib/heart-rate";
import { saveLastDevice } from "@/lib/last-device";
import type { HeartRateDevice } from "@/lib/heart-rate-types";
import {
  clearReadingAtom,
  errorAtom,
  isConnectedAtom,
  isScanningAtom,
  isStartingAtom,
  selectedDeviceAtom,
  selectedDeviceIdAtom,
  setDevicesAtom,
  statusAtom,
} from "@/state/heart-rate";

export function Controls() {
  const selectedDeviceId = useAtomValue(selectedDeviceIdAtom);
  const selectedDevice = useAtomValue(selectedDeviceAtom);
  const isScanning = useAtomValue(isScanningAtom);
  const isStarting = useAtomValue(isStartingAtom);
  const isConnected = useAtomValue(isConnectedAtom);
  const setDevices = useSetAtom(setDevicesAtom);
  const setError = useSetAtom(errorAtom);
  const setIsScanning = useSetAtom(isScanningAtom);
  const setIsStarting = useSetAtom(isStartingAtom);
  const clearReading = useSetAtom(clearReadingAtom);
  const setStatus = useSetAtom(statusAtom);

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
    setIsStarting(true);
    clearReading();

    try {
      await invoke("start_heart_rate_monitor", {
        deviceId: selectedDeviceId,
      });
      // 次回起動時の自動再接続先として、接続を開始できたデバイスを覚えておく。
      if (selectedDevice) {
        saveLastDevice(selectedDevice);
      }
    } catch (startError) {
      setError(String(startError));
    } finally {
      setIsStarting(false);
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
      <Button className="h-10 font-bold" type="button" onClick={scanDevices} disabled={isScanning || isStarting}>
        <Radio aria-hidden="true" />
        {isScanning ? "検索中..." : "スキャン"}
      </Button>
      <Button className="h-10 font-bold" type="button" onClick={startMonitor} disabled={!selectedDeviceId || isStarting || isScanning}>
        <Bluetooth aria-hidden="true" />
        {isStarting ? "接続中..." : isConnected ? "再接続" : "接続"}
      </Button>
      <Button className="h-10 font-bold" type="button" variant="secondary" onClick={stopMonitor} disabled={!selectedDeviceId}>
        <Square aria-hidden="true" />
        停止
      </Button>
    </div>
  );
}
