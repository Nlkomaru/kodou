import type { HeartRateReading, HeartRateStats, HeartRateStatusEvent, OscArg, OscMessage } from "./heart-rate-types";

// Kodou標準のAvatar Parameter接頭辞。
// VRCOSCに対応するパラメータが無いものの既定アドレスとして使う。
export const KODOU_PREFIX = "/avatar/parameters/Kodou";

// Kodouが送れるOSCパラメータの一覧。
// 実際にどのアドレスへ送るかは config.conf の compatibility セクションが決める。
export type OscParamKey =
  | "connected"
  | "reconnecting"
  | "hr"
  | "hrFloat"
  | "hrNormalised"
  | "hrAverage"
  | "battery"
  | "batteryFloat"
  | "beatToggle"
  | "beatPulse"
  | "rrInterval"
  | "rrTwitchUp"
  | "rrTwitchDown"
  | "activity"
  | "legacyEnabled"
  | "legacyUnits"
  | "legacyTens"
  | "legacyHundreds";

export type OscParamMeta = {
  key: OscParamKey;
  label: string;
  /** RustのOscArgタグ名。 */
  type: "Bool" | "Int" | "Float";
  note: string;
};

// UIの一覧表示用。送信の有無はアドレスが設定されているかどうかで決まる。
export const OSC_PARAM_META: OscParamMeta[] = [
  { key: "connected", label: "Connected", type: "Bool", note: "受信中 true" },
  { key: "reconnecting", label: "Reconnecting", type: "Bool", note: "再接続中 true" },
  { key: "hr", label: "HR", type: "Int", note: "現在 BPM" },
  { key: "hrFloat", label: "HRFloat", type: "Float", note: "BPM float化" },
  { key: "hrNormalised", label: "HRNormalised", type: "Float", note: "0〜1正規化" },
  { key: "hrAverage", label: "HRAverage", type: "Int", note: "平均 BPM" },
  { key: "battery", label: "Battery", type: "Int", note: "0〜100" },
  { key: "batteryFloat", label: "BatteryFloat", type: "Float", note: "0.0〜1.0" },
  { key: "beatToggle", label: "BeatToggle", type: "Bool", note: "拍ごとトグル" },
  { key: "beatPulse", label: "BeatPulse", type: "Bool", note: "拍で短時間 true" },
  { key: "rrInterval", label: "RRInterval", type: "Int", note: "最新 RR interval ms" },
  { key: "rrTwitchUp", label: "RRTwitchUp", type: "Bool", note: "RR間隔増加検出" },
  { key: "rrTwitchDown", label: "RRTwitchDown", type: "Bool", note: "RR間隔減少検出" },
  { key: "activity", label: "Activity", type: "Int", note: "アクティビティ番号" },
  { key: "legacyEnabled", label: "Legacy/Enabled", type: "Bool", note: "旧形式 接続状態" },
  { key: "legacyUnits", label: "Legacy/Units", type: "Float", note: "BPM 1の位 /10" },
  { key: "legacyTens", label: "Legacy/Tens", type: "Float", note: "BPM 10の位 /10" },
  { key: "legacyHundreds", label: "Legacy/Hundreds", type: "Float", note: "BPM 100の位 /10" },
];

// config.conf の compatibility セクション。パラメータ名 → 送信先アドレスの配列。
// アドレスが1つも無いパラメータは送信しない。
export type OscAddressMap = Partial<Record<OscParamKey, string[]>>;

// config.conf の osc セクション。
export type OscSettings = {
  targets: string[];
  bpmMin: number;
  bpmMax: number;
  hrFloatMode: "signed" | "unsigned";
  averageWindowMs: number;
  beatPulseMs: number;
  rrTwitchThresholdMs: number;
};

// Rustの get_config コマンドが返す設定一式。
export type AppConfig = {
  osc: OscSettings;
  compatibility: OscAddressMap;
};

// Tauri外（Storybook / ブラウザ）で動かすときのフォールバック。
// 実際の既定値はRust側（config.rs）が持つ。ここではOSC送信が発生しないため、
// 送信先とアドレス表を空にして「何も送らない」状態にしておく。
export const FALLBACK_CONFIG: AppConfig = {
  osc: {
    targets: [],
    bpmMin: 0,
    bpmMax: 240,
    hrFloatMode: "signed",
    averageWindowMs: 10_000,
    beatPulseMs: 120,
    rrTwitchThresholdMs: 50,
  },
  compatibility: {},
};

// 心拍が未受信のとき、値系パラメータを0相当にするための既定値。
const NO_BPM = 0;
const NO_BATTERY = 0;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number) {
  return Math.min(1, Math.max(-1, value));
}

// BPMをBPM下限・上限を使って正規化する。
// floatModeがunsignedなら0..1、signedなら-1..1へ写す。
function normaliseBpm(bpm: number, bounds: { min: number; max: number }, floatMode: "signed" | "unsigned") {
  const span = Math.max(1, bounds.max - bounds.min);
  const ratio = (bpm - bounds.min) / span;
  return floatMode === "signed" ? clampSigned(2 * ratio - 1) : clamp01(ratio);
}

// BPMを3桁に分解し、各桁を10で割ったfloatにする。
function legacyDigits(bpm: number) {
  const hundreds = Math.floor(bpm / 100) % 10;
  const tens = Math.floor(bpm / 10) % 10;
  const units = bpm % 10;
  return {
    units: units / 10,
    tens: tens / 10,
    hundreds: hundreds / 10,
  };
}

// アドレスを持たない、パラメータキーと値の組。
// 「どの値を送るか」と「どのアドレスへ送るか」を分けることで、
// config.conf のアドレス表を差し替えるだけで送信先を変えられる。
export type OscParamValue = {
  key: OscParamKey;
  arg: OscArg;
};

export type OscSenderInput = {
  reading: HeartRateReading | null;
  status: HeartRateStatusEvent;
  stats: HeartRateStats;
  bounds: { min: number; max: number };
  floatMode: "signed" | "unsigned";
};

// パラメータキーに設定されたアドレスへ値を展開する。
// 1つのパラメータに複数アドレスを書けるため、同じ値を複数アドレスへ複製できる。
// アドレスが空のパラメータは送信対象から外れる。
export function expandByAddressMap(values: OscParamValue[], addresses: OscAddressMap): OscMessage[] {
  const messages: OscMessage[] = [];
  for (const value of values) {
    for (const address of addresses[value.key] ?? []) {
      messages.push({ address, arg: value.arg });
    }
  }
  return messages;
}

// そのパラメータに送信先アドレスが設定されているか。
export function hasAddress(addresses: OscAddressMap, key: OscParamKey): boolean {
  return (addresses[key] ?? []).length > 0;
}

// 送信対象になっている（アドレスが1つ以上ある）パラメータキーの一覧。
export function activeParamKeys(addresses: OscAddressMap): OscParamKey[] {
  return OSC_PARAM_META.map((meta) => meta.key).filter((key) => hasAddress(addresses, key));
}

// 拍ごとに送るBeatToggle/BeatPulseとRR Twitchを除く、心拍データから静的に決まる値を組み立てる。
// 毎回同じ順序で生成し、ReactのuseMemoで差分が拾えるようにする。
export function buildStaticOscValues(input: OscSenderInput): OscParamValue[] {
  const { reading, status, stats, bounds, floatMode } = input;

  const bpm = reading?.bpm ?? NO_BPM;
  const battery = reading?.batteryPercent ?? NO_BATTERY;
  const rrInterval = reading?.rrIntervalsMs.at(-1) ?? NO_BPM;
  const isConnected = status.state === "connected";
  const isReconnecting = status.state === "reconnecting";
  const digits = legacyDigits(bpm);

  return [
    { key: "connected", arg: { kind: "Bool", value: isConnected } },
    { key: "reconnecting", arg: { kind: "Bool", value: isReconnecting } },
    { key: "hr", arg: { kind: "Int", value: bpm } },
    {
      key: "hrFloat",
      arg: {
        kind: "Float",
        value: reading ? normaliseBpm(bpm, bounds, floatMode) : floatMode === "signed" ? -1 : 0,
      },
    },
    {
      key: "hrNormalised",
      arg: { kind: "Float", value: reading ? clamp01(normaliseBpm(bpm, bounds, "unsigned")) : 0 },
    },
    { key: "hrAverage", arg: { kind: "Int", value: stats.avgBpm ?? 0 } },
    { key: "battery", arg: { kind: "Int", value: battery } },
    { key: "batteryFloat", arg: { kind: "Float", value: clamp01(battery / 100) } },
    { key: "rrInterval", arg: { kind: "Int", value: rrInterval } },
    { key: "legacyEnabled", arg: { kind: "Bool", value: isConnected } },
    { key: "legacyUnits", arg: { kind: "Float", value: digits.units } },
    { key: "legacyTens", arg: { kind: "Float", value: digits.tens } },
    { key: "legacyHundreds", arg: { kind: "Float", value: digits.hundreds } },
  ];
}

// 拍のタイミングを64ms単位で丸める最小値。極端に低いBPMでも休止しすぎないため。
export const MIN_BEAT_INTERVAL_MS = 120;

export function beatIntervalMs(bpm: number) {
  if (!bpm || bpm <= 0) return null;
  return Math.max(MIN_BEAT_INTERVAL_MS, Math.round(60_000 / bpm));
}
