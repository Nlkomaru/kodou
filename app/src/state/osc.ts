import { atom } from "jotai";
import { activeParamKeys, FALLBACK_CONFIG, type AppConfig } from "@/lib/osc";

// OSC用の平均窓は state/heart-rate で定義しているため再エクスポートし、
// UI/hookからは "@/state/osc" で完結して参照できるようにする。
export { oscAverageWindowMsAtom } from "@/state/heart-rate";

// 送信のON/OFF。UIに残している唯一の設定で、無効の間は一切送信しない。
export const oscEnabledAtom = atom(false);

// config.conf から読み込んだ設定一式。起動時にRustの get_config で取得する。
// 送信先・送信するパラメータ・数値設定はすべてここに入る。
export const oscConfigAtom = atom<AppConfig>(FALLBACK_CONFIG);

// 以下は表示と送信で使う派生atom。設定の実体は oscConfigAtom 1つに集約する。
export const oscSettingsAtom = atom((get) => get(oscConfigAtom).osc);
export const oscTargetsAtom = atom((get) => get(oscConfigAtom).osc.targets);
export const oscAddressesAtom = atom((get) => get(oscConfigAtom).compatibility);

// 送信先アドレスが設定されている（＝実際に送信される）パラメータの一覧。
export const activeOscParamsAtom = atom((get) => activeParamKeys(get(oscConfigAtom).compatibility));
