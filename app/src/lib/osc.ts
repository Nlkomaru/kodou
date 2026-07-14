import type { HeartRateReading, HeartRateStats, HeartRateStatusEvent, OscMessage } from "./heart-rate-types";

// 送信時にRustへ渡すOSCメッセージに、互換モード展開用に由来パラメータキーを添えたもの。
export type TaggedOscMessage = OscMessage & { key: OscParamKey };

// VRChatのAvatar Parameter OSCで使う先頭アドレス。
// iron-heart互換モードでもこのprefixのまま送る。
export const DEFAULT_OSC_TARGET = "127.0.0.1:9000";
export const DEFAULT_OSC_TARGETS: string[] = [DEFAULT_OSC_TARGET];
export const KODOU_PREFIX = "/avatar/parameters/Kodou";

// 「1行1つ」で書かれた送信先テキストを配列へ変換する。空行と前後の空白は無視する。
export function parseOscTargets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// config.conf 由来の送信先とGUIで入力された送信先を統合する。
// 両方に同じ "ip:port" が書かれていても二重送信しないよう、重複は取り除く。
export function mergeOscTargets(configTargets: string[], guiTargets: string[]): string[] {
  const merged = [...configTargets, ...guiTargets]
    .map((target) => target.trim())
    .filter((target) => target.length > 0);
  return [...new Set(merged)];
}

// Kodou標準の各OSCパラメータ。
// UIのチェックボックスと送信先アドレスを1箇所で管理する。
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
  address: string;
  /** RustのOscArgタグ名。 */
  type: "Bool" | "Int" | "Float";
  note: string;
};

// 実装状況や既定値は docs/content/docs/osc/index.mdx の表に合わせる。
export const OSC_PARAM_META: OscParamMeta[] = [
  { key: "connected", label: "Connected", address: `${KODOU_PREFIX}/Connected`, type: "Bool", note: "受信中 true" },
  { key: "reconnecting", label: "Reconnecting", address: `${KODOU_PREFIX}/Reconnecting`, type: "Bool", note: "再接続中 true" },
  { key: "hr", label: "HR", address: `${KODOU_PREFIX}/HR`, type: "Int", note: "現在 BPM" },
  { key: "hrFloat", label: "HRFloat", address: `${KODOU_PREFIX}/HRFloat`, type: "Float", note: "BPM float化" },
  { key: "hrNormalised", label: "HRNormalised", address: `${KODOU_PREFIX}/HRNormalised`, type: "Float", note: "0〜1正規化" },
  { key: "hrAverage", label: "HRAverage", address: `${KODOU_PREFIX}/HRAverage`, type: "Int", note: "平均 BPM" },
  { key: "battery", label: "Battery", address: `${KODOU_PREFIX}/Battery`, type: "Int", note: "0〜100" },
  { key: "batteryFloat", label: "BatteryFloat", address: `${KODOU_PREFIX}/BatteryFloat`, type: "Float", note: "0.0〜1.0" },
  { key: "beatToggle", label: "BeatToggle", address: `${KODOU_PREFIX}/BeatToggle`, type: "Bool", note: "拍ごとトグル" },
  { key: "beatPulse", label: "BeatPulse", address: `${KODOU_PREFIX}/BeatPulse`, type: "Bool", note: "拍で短時間 true" },
  { key: "rrInterval", label: "RRInterval", address: `${KODOU_PREFIX}/RRInterval`, type: "Int", note: "最新 RR interval ms" },
  { key: "rrTwitchUp", label: "RRTwitchUp", address: `${KODOU_PREFIX}/RRTwitchUp`, type: "Bool", note: "RR間隔増加検出" },
  { key: "rrTwitchDown", label: "RRTwitchDown", address: `${KODOU_PREFIX}/RRTwitchDown`, type: "Bool", note: "RR間隔減少検出" },
  { key: "activity", label: "Activity", address: `${KODOU_PREFIX}/Activity`, type: "Int", note: "アクティビティ番号" },
  { key: "legacyEnabled", label: "Legacy/Enabled", address: `${KODOU_PREFIX}/Legacy/Enabled`, type: "Bool", note: "旧形式 接続状態" },
  { key: "legacyUnits", label: "Legacy/Units", address: `${KODOU_PREFIX}/Legacy/Units`, type: "Float", note: "BPM 1の位 /10" },
  { key: "legacyTens", label: "Legacy/Tens", address: `${KODOU_PREFIX}/Legacy/Tens`, type: "Float", note: "BPM 10の位 /10" },
  { key: "legacyHundreds", label: "Legacy/Hundreds", address: `${KODOU_PREFIX}/Legacy/Hundreds`, type: "Float", note: "BPM 100の位 /10" },
];

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

export type OscSenderInput = {
  reading: HeartRateReading | null;
  status: HeartRateStatusEvent;
  stats: HeartRateStats;
  params: Record<OscParamKey, boolean>;
  bounds: { min: number; max: number };
  floatMode: "signed" | "unsigned";
};

// iron-heart互換モードで送るアドレス。
// Kodou標準の同名パラメータを、古い名前のアドレスへも複製する。
export const IRON_HEART_ADDRESS: Partial<Record<OscParamKey, string>> = {
  connected: "/avatar/parameters/isHRConnected",
  reconnecting: "/avatar/parameters/isHRReconnecting",
  battery: "/avatar/parameters/HRBattery",
  batteryFloat: "/avatar/parameters/HRBatteryFloat",
  beatToggle: "/avatar/parameters/HeartBeatToggle",
  beatPulse: "/avatar/parameters/isHRBeat",
  hr: "/avatar/parameters/HR",
  hrFloat: "/avatar/parameters/floatHR",
  rrInterval: "/avatar/parameters/RRInterval",
  rrTwitchUp: "/avatar/parameters/HRTwitchUp",
  rrTwitchDown: "/avatar/parameters/HRTwitchDown",
  activity: "/avatar/parameters/HRActivity",
};

// VRCOSC互換モードで送るアドレス。
export const VRCOSC_ADDRESS: Partial<Record<OscParamKey, string>> = {
  connected: "/avatar/parameters/VRCOSC/Heartrate/Connected",
  hr: "/avatar/parameters/VRCOSC/Heartrate/Value",
  hrNormalised: "/avatar/parameters/VRCOSC/Heartrate/Normalised",
  hrAverage: "/avatar/parameters/VRCOSC/Heartrate/Average",
  beatToggle: "/avatar/parameters/VRCOSC/Heartrate/Beat",
  legacyEnabled: "/avatar/parameters/VRCOSC/Heartrate/Enabled",
  legacyUnits: "/avatar/parameters/VRCOSC/Heartrate/Units",
  legacyTens: "/avatar/parameters/VRCOSC/Heartrate/Tens",
  legacyHundreds: "/avatar/parameters/VRCOSC/Heartrate/Hundreds",
};

// 互換モードが有効なとき、各パラメータの互換先へ同じ値を複製する。
function expandCompat(
  messages: TaggedOscMessage[],
  addressMap: Partial<Record<OscParamKey, string>>,
): TaggedOscMessage[] {
  const mirrored: TaggedOscMessage[] = [];
  for (const message of messages) {
    const address = addressMap[message.key];
    if (address) {
      mirrored.push({ ...message, address });
    }
  }
  return mirrored;
}

// TaggedOscMessageからパラメータキーを取り除き、Rust送信に使う形にする。
export function stripKeys(messages: TaggedOscMessage[]): OscMessage[] {
  return messages.map(({ address, arg }) => ({ address, arg }));
}

// 互換モードを反映したうえで送信メッセージ一覧を返す。
export function withCompat(
  messages: TaggedOscMessage[],
  ironHeart: boolean,
  vrcosc: boolean,
): TaggedOscMessage[] {
  let result = messages;
  if (ironHeart) {
    result = [...result, ...expandCompat(messages, IRON_HEART_ADDRESS)];
  }
  if (vrcosc) {
    result = [...result, ...expandCompat(messages, VRCOSC_ADDRESS)];
  }
  return result;
}

// 拍ごとに送るBeatToggle/BeatPulseを除く、静的に決まるOSCメッセージを組み立てる。
// 毎回同じ順序で生成し、ReactのuseMemoで差分が拾えるようにする。
export function buildStaticOscMessages(input: OscSenderInput): TaggedOscMessage[] {
  const { reading, status, stats, params, bounds, floatMode } = input;

  const bpm = reading?.bpm ?? NO_BPM;
  const battery = reading?.batteryPercent ?? NO_BATTERY;
  const rrInterval = reading?.rrIntervalsMs.at(-1) ?? NO_BPM;
  const isConnected = status.state === "connected";
  const isReconnecting = status.state === "reconnecting";
  const digits = legacyDigits(bpm);

  const messages: TaggedOscMessage[] = [];

  if (params.connected) {
    messages.push({ key: "connected", address: `${KODOU_PREFIX}/Connected`, arg: { kind: "Bool", value: isConnected } });
  }
  if (params.reconnecting) {
    messages.push({ key: "reconnecting", address: `${KODOU_PREFIX}/Reconnecting`, arg: { kind: "Bool", value: isReconnecting } });
  }
  if (params.hr) {
    messages.push({ key: "hr", address: `${KODOU_PREFIX}/HR`, arg: { kind: "Int", value: bpm } });
  }
  if (params.hrFloat) {
    messages.push({
      key: "hrFloat",
      address: `${KODOU_PREFIX}/HRFloat`,
      arg: { kind: "Float", value: reading ? normaliseBpm(bpm, bounds, floatMode) : floatMode === "signed" ? -1 : 0 },
    });
  }
  if (params.hrNormalised) {
    messages.push({
      key: "hrNormalised",
      address: `${KODOU_PREFIX}/HRNormalised`,
      arg: { kind: "Float", value: reading ? clamp01(normaliseBpm(bpm, bounds, "unsigned")) : 0 },
    });
  }
  if (params.hrAverage) {
    messages.push({ key: "hrAverage", address: `${KODOU_PREFIX}/HRAverage`, arg: { kind: "Int", value: stats.avgBpm ?? 0 } });
  }
  if (params.battery) {
    messages.push({ key: "battery", address: `${KODOU_PREFIX}/Battery`, arg: { kind: "Int", value: battery } });
  }
  if (params.batteryFloat) {
    messages.push({ key: "batteryFloat", address: `${KODOU_PREFIX}/BatteryFloat`, arg: { kind: "Float", value: clamp01(battery / 100) } });
  }
  if (params.rrInterval) {
    messages.push({ key: "rrInterval", address: `${KODOU_PREFIX}/RRInterval`, arg: { kind: "Int", value: rrInterval } });
  }
  if (params.legacyEnabled) {
    messages.push({ key: "legacyEnabled", address: `${KODOU_PREFIX}/Legacy/Enabled`, arg: { kind: "Bool", value: isConnected } });
  }
  if (params.legacyUnits) {
    messages.push({ key: "legacyUnits", address: `${KODOU_PREFIX}/Legacy/Units`, arg: { kind: "Float", value: digits.units } });
  }
  if (params.legacyTens) {
    messages.push({ key: "legacyTens", address: `${KODOU_PREFIX}/Legacy/Tens`, arg: { kind: "Float", value: digits.tens } });
  }
  if (params.legacyHundreds) {
    messages.push({ key: "legacyHundreds", address: `${KODOU_PREFIX}/Legacy/Hundreds`, arg: { kind: "Float", value: digits.hundreds } });
  }

  return messages;
}

// 拍のタイミングを64ms単位で丸める最小値。極端に低いBPMでも休止しすぎないため。
export const MIN_BEAT_INTERVAL_MS = 120;

export function beatIntervalMs(bpm: number) {
  if (!bpm || bpm <= 0) return null;
  return Math.max(MIN_BEAT_INTERVAL_MS, Math.round((60_000 / bpm)));
}