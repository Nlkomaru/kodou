import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSetAtom } from "jotai";
import { isTauriRuntime } from "@/lib/heart-rate";
import type { HeartRateReading, HeartRateStatusEvent } from "@/lib/heart-rate-types";
import { saveMonitorStopped } from "@/lib/startup";
import { applyReadingAtom, errorAtom, recordingPathAtom, setTauriUnavailableAtom, statusAtom } from "@/state/heart-rate";

export function useHeartRateEvents() {
  const applyReading = useSetAtom(applyReadingAtom);
  const setError = useSetAtom(errorAtom);
  const setStatus = useSetAtom(statusAtom);
  const setRecordingPath = useSetAtom(recordingPathAtom);
  const setTauriUnavailable = useSetAtom(setTauriUnavailableAtom);

  useEffect(() => {
    // Vite previewではTauriイベントを購読できない。
    // それでも画面を表示できるようにして、レイアウト確認をしやすくする。
    if (!isTauriRuntime()) {
      setTauriUnavailable();
      return;
    }

    let mounted = true;
    const unlisteners: Array<() => void> = [];

    async function bindHeartRateEvents() {
      const unlistenReading = await listen<HeartRateReading>("heart-rate-reading", (event) => {
        applyReading(event.payload);
      });
      const unlistenStatus = await listen<HeartRateStatusEvent>("heart-rate-status", (event) => {
        setStatus(event.payload);
      });
      const unlistenRecordingStarted = await listen<string>("recording-started", (event) => {
        setRecordingPath(event.payload);
      });
      // 一時的なBLE切断ではなく、監視セッションが自動停止した場合だけ停止状態を記憶する。
      const unlistenMonitoringStopped = await listen("monitoring_stopped", () => {
        if (mounted) saveMonitorStopped(true);
      });
      const unlistenRecordingStopped = await listen("recording-stopped", () => {
        setRecordingPath(null);
      });

      if (mounted) {
        unlisteners.push(unlistenReading, unlistenStatus, unlistenRecordingStarted, unlistenRecordingStopped, unlistenMonitoringStopped);
      } else {
        unlistenReading();
        unlistenStatus();
        unlistenRecordingStarted();
        unlistenMonitoringStopped();
        unlistenRecordingStopped();
      }
    }

    bindHeartRateEvents().catch((eventError) => {
      setError(String(eventError));
    });

    return () => {
      mounted = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [applyReading, setError, setStatus, setRecordingPath, setTauriUnavailable]);
}
