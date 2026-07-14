import { atom } from "jotai";
import { DEFAULT_OSC_TARGETS, mergeOscTargets, OSC_PARAM_META, type OscParamKey } from "@/lib/osc";

// OSC用の平均窓は state/heart-rate で定義しているため再エクスポートし、
// UI/hookからは "@/state/osc" で完結して参照できるようにする。
export { oscAverageWindowMsAtom } from "@/state/heart-rate";

// 既定のパラメータ ON/OFF。必要な設定が整っていないものや、
// 余分な互換パラメータは既定で無効にしておく。
const defaultParams: Record<OscParamKey, boolean> = {
  connected: true,
  reconnecting: true,
  hr: true,
  hrFloat: true,
  hrNormalised: true,
  hrAverage: true,
  battery: true,
  batteryFloat: true,
  beatToggle: true,
  beatPulse: true,
  rrInterval: true,
  rrTwitchUp: false,
  rrTwitchDown: false,
  activity: false,
  legacyEnabled: false,
  legacyUnits: false,
  legacyTens: false,
  legacyHundreds: false,
};

export const oscEnabledAtom = atom(false);

// GUIで編集する送信先。アプリを閉じると失われるため、常用する送信先は config.conf に書く。
export const oscTargetsAtom = atom<string[]>(DEFAULT_OSC_TARGETS);

// config.conf の osc.targets。起動時にRustから読み込む読み取り専用の値。
export const configOscTargetsAtom = atom<string[]>([]);

// 実際にRustへ渡す送信先。config.confとGUIの送信先を統合し、重複を除く。
export const effectiveOscTargetsAtom = atom((get) =>
  mergeOscTargets(get(configOscTargetsAtom), get(oscTargetsAtom)),
);

export const oscParamsAtom = atom<Record<OscParamKey, boolean>>(defaultParams);

// 個別パラメータのON/OFFをトグルする書き込みatom。
export const toggleOscParamAtom = atom(
  null,
  (get, set, key: OscParamKey) => {
    const current = get(oscParamsAtom);
    set(oscParamsAtom, { ...current, [key]: !current[key] });
  },
);

// HRFloat/HRNormalisedで使うBPM上下限。VRCOSC既定の0..240に合わせる。
export const hrBoundsAtom = atom({ min: 0, max: 240 });

// HRFloatを-1..1と0..1のどちらで送るか。既定は-1..1（iron-heart準拠）。
export const hrFloatModeAtom = atom<"signed" | "unsigned">("signed");

// iron-heart/VRCOSC互換モード。互換アドレスへも同名義のパラメータを複製する。
export const ironHeartCompatAtom = atom(false);
export const vrcoscCompatAtom = atom(false);

// BeatPulseをtrueにしてからfalseへ戻すまでの時間。
// 拍周期の4分の1と最大120msの中間で、次の拍に被らないようにする。
export const beatPulseMsAtom = atom(120);

// RR intervalの差分からTwitchUp/Downを判定するしきい値（ms）。iron-heart既定値。
export const rrTwitchThresholdMsAtom = atom(50);

// 許容されるパラメータキー一覧。UI出力用。
export const oscParamKeys = OSC_PARAM_META.map((meta) => meta.key);