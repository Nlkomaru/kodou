import { createContext, useContext, useEffect, type ReactNode } from "react";
import { FluentProvider } from "@fluentui/react-components";
import { useAtomValue } from "jotai";
import { kodouThemes, type ThemePreference, type ThemeScheme } from "@/lib/theme";
import { resolvedThemeSchemeAtom, systemThemeSchemeAtom } from "@/state/theme";

// 入れ子のプレビューでは、内側のテーマが文書全体の配色を上書きしないようにする。
const ThemeProviderContext = createContext(false);

// 実際に適用する配色を求める。preference を渡すと保存済みの設定より優先する
// （Storybookのツールバーのように、アプリの設定を汚さず切り替えたい場合に使う）。
function useResolvedThemeScheme(preference?: ThemePreference): ThemeScheme {
  const storedScheme = useAtomValue(resolvedThemeSchemeAtom);
  const systemScheme = useAtomValue(systemThemeSchemeAtom);
  if (preference === undefined) return storedScheme;
  return preference === "system" ? systemScheme : preference;
}

type ThemeProviderProps = {
  children: ReactNode;
  // 指定時は保存設定を無視してこのテーマを使う（永続化はしない）。
  preference?: ThemePreference;
};

export function ThemeProvider({ children, preference }: ThemeProviderProps) {
  const scheme = useResolvedThemeScheme(preference);
  const nested = useContext(ThemeProviderContext);

  // 文書全体は最上位のテーマだけが更新する。部品とポータルの配色はテーマトークンで解決する。
  useEffect(() => {
    if (nested) return;
    const root = document.documentElement;
    const previousScheme = root.style.colorScheme;
    const previousMarker = root.dataset.colorScheme;
    root.style.colorScheme = scheme;
    root.dataset.colorScheme = scheme;
    return () => {
      root.style.colorScheme = previousScheme;
      if (previousMarker === undefined) delete root.dataset.colorScheme;
      else root.dataset.colorScheme = previousMarker;
    };
  }, [scheme, nested]);

  return (
    <ThemeProviderContext.Provider value={true}>
      <FluentProvider theme={kodouThemes[scheme]} className="kodou-theme-root">
        {children}
      </FluentProvider>
    </ThemeProviderContext.Provider>
  );
}
