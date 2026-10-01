import { atom } from "jotai";
import { isThemePreference, type ThemePreference, type ThemeScheme } from "@/lib/theme";

// テーマ設定。localStorageへ永続化し、再起動後も選択を維持する。
// 未設定・読み取り失敗時は system を既定にする（OSの設定に追従）。
const THEME_PREFERENCE_KEY = "kodou-theme-preference";
const themePreferenceBaseAtom = atom<ThemePreference>((() => {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch { return "system"; }
})());
export const themePreferenceAtom = atom(
  (get) => get(themePreferenceBaseAtom),
  (_get, set, value: ThemePreference) => {
    set(themePreferenceBaseAtom, value);
    try { localStorage.setItem(THEME_PREFERENCE_KEY, value); } catch { /* ignore */ }
  },
);

// OSの配色設定（prefers-color-scheme）。system 選択時はこの値に追従する。
// 初期表示でちらつかないよう、マウント前にも現在のOS設定から値を決めておく。
const systemSchemeBaseAtom = atom<ThemeScheme>((() => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
})());

// 表示中の間だけOSの設定変更を購読する。破棄時はリスナーも外す。
systemSchemeBaseAtom.onMount = (setScheme) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (event: MediaQueryListEvent) => setScheme(event.matches ? "dark" : "light");
  query.addEventListener("change", handleChange);
  // 読み込みからマウントまでにOS設定が変わっていても、最新の配色に同期する。
  setScheme(query.matches ? "dark" : "light");
  return () => query.removeEventListener("change", handleChange);
};

export const systemThemeSchemeAtom = atom((get) => get(systemSchemeBaseAtom));

// 設定とOS設定から、実際に適用する配色を求める。
export const resolvedThemeSchemeAtom = atom<ThemeScheme>((get) => {
  const preference = get(themePreferenceAtom);
  return preference === "system" ? get(systemThemeSchemeAtom) : preference;
});
