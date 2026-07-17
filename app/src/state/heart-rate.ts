import { atom } from "jotai";
import { appendHistory, CHART_WINDOW_MS, computeStats, getSyncedTimeDomain, rrIntervalsToPoints } from "@/lib/heart-rate";
import type { HeartRateDevice, HeartRateReading, HeartRateStats, HeartRateStatusEvent, MetricPoint } from "@/lib/heart-rate-types";

export const disconnectedStatus: HeartRateStatusEvent = {
  state: "disconnected",
  message: "Bluetooth 心拍センサーは未接続です。",
  deviceId: null,
};

// 元データのatom。Tauri/BLEから受け取った最新状態を、なるべく加工せず保持する。
export const devicesAtom = atom<HeartRateDevice[]>([]);
export const selectedDeviceIdAtom = atom("");
export const readingAtom = atom<HeartRateReading | null>(null);
export const bpmHistoryAtom = atom<MetricPoint[]>([]);
export const rrHistoryAtom = atom<MetricPoint[]>([]);
export const statusAtom = atom<HeartRateStatusEvent>(disconnectedStatus);
export const isScanningAtom = atom(false);
/** @deprecated controls.tsx の移行後は削除予定。代わりに statusAtom.state を直接参照してください。 */
export const isStartingAtom = atom(false);
export const errorAtom = atom("");

// 記録中のParquetファイルパス。nullなら未記録。
export const recordingPathAtom = atom<string | null>(null);
// 記録中かどうかの派生atom。
export const isRecordingAtom = atom((get) => get(recordingPathAtom) !== null);

// 派生atom。UIコンポーネント側で同じ検索や判定を繰り返さないために置く。
export const selectedDeviceAtom = atom((get) =>
  get(devicesAtom).find((device) => device.id === get(selectedDeviceIdAtom)),
);

export const isConnectedAtom = atom((get) => get(statusAtom).state === "connected");


// 接続状態を日本語ラベルに変換する派生atom。
export const connectionStatusLabelAtom = atom((get) => {
  const state = get(statusAtom).state;
  switch (state) {
    case "scanning":
      return "検索中…";
    case "connecting":
      return "接続中…";
    case "connected":
      return "接続済み";
    case "reconnecting":
      return "再接続中…";
    case "disconnected":
      return "未接続";
    case "warning":
      return "警告";
    case "error":
      return "エラー";
  }
});

// 接続状態をAlert variantに変換する派生atom。
export const connectionStatusVariantAtom = atom<"default" | "destructive">((get) => {
  const state = get(statusAtom).state;
  switch (state) {
    case "error":
      return "destructive";
    default:
      return "default";
  }
});
export const syncedTimeDomainAtom = atom((get) => getSyncedTimeDomain(get(bpmHistoryAtom), get(rrHistoryAtom)));

// 統計表示窓とOSCのAverage窓。双方向で参照する純が異なるため分けて持つ。
export const statsWindowMsAtom = atom(CHART_WINDOW_MS);

export const heartRateStatsAtom = atom<HeartRateStats>((get) =>
  computeStats(get(bpmHistoryAtom), get(rrHistoryAtom), get(statsWindowMsAtom)),
);

// OSC用の平均窓。VRCOSC既定の10000msに合わせる。
export const oscAverageWindowMsAtom = atom(10_000);

export const oscAverageBpmAtom = atom<number | null>((get) =>
  computeStats(get(bpmHistoryAtom), get(rrHistoryAtom), get(oscAverageWindowMsAtom)).avgBpm,
);

// OSC送信で参照する平均BPMを含む一行分の統計派生。
export const oscStatsAtom = atom<HeartRateStats>((get) =>
  computeStats(get(bpmHistoryAtom), get(rrHistoryAtom), get(oscAverageWindowMsAtom)),
);

// 書き込みatom。Tauriイベントや操作ボタンから使う小さな状態遷移をまとめる。
export const applyReadingAtom = atom(null, (_get, set, reading: HeartRateReading) => {
  const timestamp = Date.now();

  set(readingAtom, reading);
  set(bpmHistoryAtom, (current) =>
    appendHistory(current, [
      {
        timestamp,
        value: reading.bpm,
      },
    ]),
  );
  set(rrHistoryAtom, (current) =>
    reading.rrIntervalsMs.length === 0
      ? current
      : appendHistory(current, rrIntervalsToPoints(timestamp, reading.rrIntervalsMs)),
  );
});

export const clearReadingAtom = atom(null, (_get, set) => {
  set(readingAtom, null);
  set(bpmHistoryAtom, []);
  set(rrHistoryAtom, []);
});

export const setDevicesAtom = atom(null, (get, set, devices: HeartRateDevice[]) => {
  set(devicesAtom, devices);
  set(selectedDeviceIdAtom, get(selectedDeviceIdAtom) || devices[0]?.id || "");
});

export const setTauriUnavailableAtom = atom(null, (_get, set) => {
  set(statusAtom, {
    state: "warning",
    message: "心拍データの検索と受信は Tauri アプリ上で利用できます。",
    deviceId: null,
  });
});
