import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAtomValue, useSetAtom } from "jotai";
import {
  beatIntervalMs,
  buildStaticOscValues,
  expandByAddressMap,
  hasAddress,
  type AppConfig,
  type OscParamValue,
} from "@/lib/osc";
import { isTauriRuntime } from "@/lib/heart-rate";
import { readingAtom, oscStatsAtom, statusAtom } from "@/state/heart-rate";
import {
  oscAddressesAtom,
  oscAverageWindowMsAtom,
  oscConfigAtom,
  oscEnabledAtom,
  oscSettingsAtom,
  oscTargetsAtom,
} from "@/state/osc";
import type { OscMessage } from "@/lib/heart-rate-types";

async function sendMessages(messages: OscMessage[]) {
  if (messages.length === 0) return;
  try {
    await invoke("send_osc", { messages });
  } catch (error) {
    // 送信失敗がフロント動作を止めないように、ここでは握りつぶす。
    // eslint-disable-next-line no-console
    console.error("OSC送信に失敗しました", error);
  }
}

// OSC送信を一手に引き受けるhook。
// 送信先・送信するパラメータのアドレス・数値設定はすべて config.conf 由来で、
// UIからは送信のON/OFFだけを切り替える。
export function useOscSender() {
  const enabled = useAtomValue(oscEnabledAtom);
  const settings = useAtomValue(oscSettingsAtom);
  const targets = useAtomValue(oscTargetsAtom);
  const addresses = useAtomValue(oscAddressesAtom);
  const setConfig = useSetAtom(oscConfigAtom);
  const setAverageWindowMs = useSetAtom(oscAverageWindowMsAtom);
  const reading = useAtomValue(readingAtom);
  const status = useAtomValue(statusAtom);
  const stats = useAtomValue(oscStatsAtom);

  const bpmRef = useRef(0);
  useEffect(() => {
    bpmRef.current = reading?.bpm ?? 0;
  }, [reading]);

  // 起動時に config.conf を1度だけ読み込む。
  // 平均窓は心拍統計の計算にも使うため、専用のatomへ反映する。
  useEffect(() => {
    if (!isTauriRuntime()) return;
    invoke<AppConfig>("get_config")
      .then((config) => {
        setConfig(config);
        setAverageWindowMs(config.osc.averageWindowMs);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("config.confを読み込めませんでした", error);
      });
  }, [setConfig, setAverageWindowMs]);

  // Rust側の送信先を設定する。無効化時は空配列を送って送信を止める。
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const configuredTargets = enabled ? targets : [];
    invoke("configure_osc", { targets: configuredTargets }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error("OSC設定に失敗しました", error);
    });
  }, [enabled, targets]);

  const bounds = useMemo(
    () => ({ min: settings.bpmMin, max: settings.bpmMax }),
    [settings.bpmMin, settings.bpmMax],
  );

  // 静的パラメータを組み立て、config.confのアドレス表に従って展開する。
  const staticMessages = useMemo<OscMessage[]>(() => {
    if (!enabled) return [];
    const values = buildStaticOscValues({
      reading,
      status,
      stats,
      bounds,
      floatMode: settings.hrFloatMode,
    });
    return expandByAddressMap(values, addresses);
  }, [enabled, reading, status, stats, bounds, settings.hrFloatMode, addresses]);

  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    void sendMessages(staticMessages);
  }, [enabled, staticMessages]);

  // 拍周期でBeatToggle/BeatPulseを送る。
  // 拍タイマーはbpmRefを見るため、BPM変化で再起動せずとも次拍で間隔が追従する。
  const sendsBeatToggle = hasAddress(addresses, "beatToggle");
  const sendsBeatPulse = hasAddress(addresses, "beatPulse");
  const beatPulseMs = settings.beatPulseMs;
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    if (!sendsBeatToggle && !sendsBeatPulse) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pulseOffTimer: ReturnType<typeof setTimeout> | undefined;
    let parity = false;

    const buildBeatMessages = (beatToggleValue: boolean, beatPulseValue: boolean): OscMessage[] => {
      const values: OscParamValue[] = [
        { key: "beatToggle", arg: { kind: "Bool", value: beatToggleValue } },
        { key: "beatPulse", arg: { kind: "Bool", value: beatPulseValue } },
      ];
      return expandByAddressMap(values, addresses);
    };

    const tick = () => {
      parity = !parity;
      void sendMessages(buildBeatMessages(parity, true));
      const intervalMs = beatIntervalMs(bpmRef.current);
      const offDelay = Math.min(beatPulseMs, Math.max(20, intervalMs != null ? Math.min(beatPulseMs, intervalMs / 4) : beatPulseMs));
      pulseOffTimer = setTimeout(() => {
        void sendMessages(buildBeatMessages(parity, false));
      }, offDelay);
      const nextDelay = intervalMs ?? 1000;
      timer = setTimeout(tick, Math.max(nextDelay, offDelay + 50));
    };

    tick();
    return () => {
      if (timer) clearTimeout(timer);
      if (pulseOffTimer) clearTimeout(pulseOffTimer);
    };
  }, [enabled, sendsBeatToggle, sendsBeatPulse, beatPulseMs, addresses]);

  // RR TwitchUp/DownはRR間隔がしきい値以上に変化した拍で短時間trueを送る。
  // 直前のRR間隔を比較して、BeatPulseのfalseパルスと同じ要領で戻す。
  const sendsTwitchUp = hasAddress(addresses, "rrTwitchUp");
  const sendsTwitchDown = hasAddress(addresses, "rrTwitchDown");
  const rrThreshold = settings.rrTwitchThresholdMs;
  const prevRrRef = useRef<number | null>(null);
  const prevReadingBpmRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    if (!sendsTwitchUp && !sendsTwitchDown) return;
    if (!reading) return;
    // 新しい心拍通知が来たときだけ差分を評価する。同じ通知で複数回呼ばない。
    if (prevReadingBpmRef.current === reading.bpm) return;
    prevReadingBpmRef.current = reading.bpm;

    const latestRr = reading.rrIntervalsMs.at(-1) ?? null;
    if (latestRr == null) {
      prevRrRef.current = null;
      return;
    }

    const previous = prevRrRef.current;
    prevRrRef.current = latestRr;
    if (previous == null) return;

    const delta = latestRr - previous;
    let triggeredKey: "rrTwitchUp" | "rrTwitchDown" | null = null;
    if (delta >= rrThreshold) triggeredKey = "rrTwitchUp";
    else if (delta <= -rrThreshold) triggeredKey = "rrTwitchDown";
    if (!triggeredKey) return;

    const key = triggeredKey;
    const build = (value: boolean): OscMessage[] =>
      expandByAddressMap([{ key, arg: { kind: "Bool", value } }], addresses);

    void sendMessages(build(true));
    const offDelay = Math.min(beatPulseMs, 200);
    const offTimer = setTimeout(() => void sendMessages(build(false)), offDelay);
    return () => clearTimeout(offTimer);
  }, [enabled, reading, sendsTwitchUp, sendsTwitchDown, rrThreshold, beatPulseMs, addresses]);
}
