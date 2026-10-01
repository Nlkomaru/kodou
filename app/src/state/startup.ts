import { atom } from "jotai";
import { loadStartupSettings, saveStartupSettings, type StartupSettings } from "@/lib/startup";

// 起動時の自動接続設定。localStorageへ永続化し、再起動後も選択を維持する。
// 保存値が無い・読み取りに失敗した場合は既定（自動接続と停止状態の引き継ぎを有効）を使う。
const startupSettingsBaseAtom = atom<StartupSettings>(loadStartupSettings());

// 設定の読み書き。書き込み時はそのまま永続化する。
export const startupSettingsAtom = atom(
  (get) => get(startupSettingsBaseAtom),
  (_get, set, value: StartupSettings) => {
    set(startupSettingsBaseAtom, value);
    saveStartupSettings(value);
  },
);

// スイッチ単位の更新用。指定しなかった項目は現在の値を保持したまま保存する。
export const updateStartupSettingsAtom = atom(
  null,
  (get, set, patch: Partial<StartupSettings>) => {
    set(startupSettingsAtom, { ...get(startupSettingsAtom), ...patch });
  },
);
