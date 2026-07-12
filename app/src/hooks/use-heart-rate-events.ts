import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSetAtom } from "jotai";
import { isTauriRuntime } from "@/lib/heart-rate";
import type { HeartRateReading, HeartRateStatusEvent } from "@/lib/heart-rate-types";
import { applyReadingAtom, errorAtom, setTauriUnavailableAtom, statusAtom } from "@/state/heart-rate";

export function useHeartRateEvents() {
  const applyReading = useSetAtom(applyReadingAtom);
  const setError = useSetAtom(errorAtom);
  const setStatus = useSetAtom(statusAtom);
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

      if (mounted) {
        unlisteners.push(unlistenReading, unlistenStatus);
      } else {
        unlistenReading();
        unlistenStatus();
      }
    }

    bindHeartRateEvents().catch((eventError) => {
      setError(String(eventError));
    });

    return () => {
      mounted = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [applyReading, setError, setStatus, setTauriUnavailable]);
}
