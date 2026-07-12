import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import {
  beatIntervalMs,
  buildStaticOscMessages,
  KODOU_PREFIX,
  stripKeys,
  withCompat,
  type TaggedOscMessage,
} from "@/lib/osc";
import { isTauriRuntime } from "@/lib/heart-rate";
import {
  readingAtom,
  oscStatsAtom,
  statusAtom,
} from "@/state/heart-rate";
import {
  beatPulseMsAtom,
  hrBoundsAtom,
  hrFloatModeAtom,
  ironHeartCompatAtom,
  oscAverageWindowMsAtom,
  oscEnabledAtom,
  oscParamsAtom,
  oscTargetAtom,
  rrTwitchThresholdMsAtom,
  vrcoscCompatAtom,
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
// 静的パラメータは読み取り時にまとめて送り、BeatToggle/BeatPulseは拍周期タイマーで送る。
// ArrRRTwitchUp/DownはRR間隔の変化点で短いパルスを送る。
export function useOscSender() {
  const enabled = useAtomValue(oscEnabledAtom);
  const target = useAtomValue(oscTargetAtom);
  const params = useAtomValue(oscParamsAtom);
  const reading = useAtomValue(readingAtom);
  const status = useAtomValue(statusAtom);
  const stats = useAtomValue(oscStatsAtom);
  const bounds = useAtomValue(hrBoundsAtom);
  const floatMode = useAtomValue(hrFloatModeAtom);
  const ironHeart = useAtomValue(ironHeartCompatAtom);
  const vrcosc = useAtomValue(vrcoscCompatAtom);
  const beatPulseMs = useAtomValue(beatPulseMsAtom);
  const rrThreshold = useAtomValue(rrTwitchThresholdMsAtom);
  // oscAverageWindowMsAtom を監視してuseEffect再実行させるだけ。値はoscStatsAtom経由で参照される。
  useAtomValue(oscAverageWindowMsAtom);

  const bpmRef = useRef(0);
  useEffect(() => {
    bpmRef.current = reading?.bpm ?? 0;
  }, [reading]);

  // Rust側の送信先を設定する。無効化時はtargetにnullを送って送信を止める。
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const configuredTarget = enabled ? target : null;
    invoke("configure_osc", { target: configuredTarget }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error("OSC設定に失敗しました", error);
    });
  }, [enabled, target]);

  // 静的パラメータを組み立てて送る。
  const staticMessages = useMemo<TaggedOscMessage[]>(() => {
    if (!enabled) return [];
    return withCompat(
      buildStaticOscMessages({
        reading,
        status,
        stats,
        params,
        bounds,
        floatMode,
      }),
      ironHeart,
      vrcosc,
    );
  }, [enabled, reading, status, stats, params, bounds, floatMode, ironHeart, vrcosc]);

  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    void sendMessages(stripKeys(staticMessages));
  }, [enabled, staticMessages]);

  // 拍周期でBeatToggle/BeatPulseを送る。
  // 拍タイマーはbpmRefを見るため、BPM変化で再起動せずとも次拍で間隔が追従する。
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    if (!params.beatToggle && !params.beatPulse) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let pulseOffTimer: ReturnType<typeof setTimeout> | undefined;
    let parity = false;

    const buildBeatMessages = (beatToggleValue: boolean, beatPulseValue: boolean): OscMessage[] => {
      const messages: TaggedOscMessage[] = [];
      if (params.beatToggle) {
        messages.push({ key: "beatToggle", address: `${KODOU_PREFIX}/BeatToggle`, arg: { kind: "Bool", value: beatToggleValue } });
      }
      if (params.beatPulse) {
        messages.push({ key: "beatPulse", address: `${KODOU_PREFIX}/BeatPulse`, arg: { kind: "Bool", value: beatPulseValue } });
      }
      return stripKeys(withCompat(messages, ironHeart, vrcosc));
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
  }, [enabled, params.beatToggle, params.beatPulse, beatPulseMs, ironHeart, vrcosc]);

  // RR TwitchUp/DownはRR間隔がしきい値以上に変化した拍で短時間trueを送る。
  // 直前のRR間隔を比較して、BeatPulseのfalseパルスと同じ要領で戻す。
  const prevRrRef = useRef<number | null>(null);
  const prevReadingBpmRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    if (!params.rrTwitchUp && !params.rrTwitchDown) return;
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

    const address =
      triggeredKey === "rrTwitchUp" ? `${KODOU_PREFIX}/RRTwitchUp` : `${KODOU_PREFIX}/RRTwitchDown`;
    const build = (value: boolean): OscMessage[] => {
      const messages: TaggedOscMessage[] = [{ key: triggeredKey, address, arg: { kind: "Bool", value } }];
      return stripKeys(withCompat(messages, ironHeart, vrcosc));
    };
    void sendMessages(build(true));
    const offDelay = Math.min(beatPulseMs, 200);
    const offTimer = setTimeout(() => void sendMessages(build(false)), offDelay);
    return () => clearTimeout(offTimer);
  }, [enabled, reading, params.rrTwitchUp, params.rrTwitchDown, rrThreshold, ironHeart, vrcosc, beatPulseMs]);
}