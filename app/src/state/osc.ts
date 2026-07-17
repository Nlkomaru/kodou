import { atom } from "jotai";
import { activeParamKeys, FALLBACK_CONFIG, type AppConfig } from "@/lib/osc";

// OSC用の平均窓は state/heart-rate で定義しているため再エクスポートし、
// UI/hookからは "@/state/osc" で完結して参照できるようにする。
export { oscAverageWindowMsAtom } from "@/state/heart-rate";

// 送信のON/OFF。localStorageへ永続化し、再起動後も状態を維持する。
const OSC_ENABLED_KEY = "kodou-osc-enabled";
const oscEnabledBaseAtom = atom((() => {
  try { return localStorage.getItem(OSC_ENABLED_KEY) === "true"; } catch { return false; }
})());
export const oscEnabledAtom = atom(
  (get) => get(oscEnabledBaseAtom),
  (_get, set, value: boolean) => {
    set(oscEnabledBaseAtom, value);
    try { localStorage.setItem(OSC_ENABLED_KEY, String(value)); } catch { /* ignore */ }
  },
);

// config.conf から読み込んだ設定一式。起動時にRustの get_config で取得する。
// 送信先・送信するパラメータ・数値設定はすべてここに入る。
export const oscConfigAtom = atom<AppConfig>(FALLBACK_CONFIG);

// 以下は表示と送信で使う派生atom。設定の実体は oscConfigAtom 1つに集約する。
export const oscSettingsAtom = atom((get) => get(oscConfigAtom).osc);
export const oscTargetsAtom = atom((get) => get(oscConfigAtom).osc.targets);
export const oscAddressesAtom = atom((get) => get(oscConfigAtom).compatibility);

// 送信先アドレスが設定されている（＝実際に送信される）パラメータの一覧。
export const activeOscParamsAtom = atom((get) => activeParamKeys(get(oscConfigAtom).compatibility));
