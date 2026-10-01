import { webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";

// ユーザーが選べるテーマ設定。system はOSの配色設定に追従する。
export type ThemePreference = "system" | "light" | "dark";

// 実際に適用される配色。system を解決した結果は light / dark のどちらかになる。
export type ThemeScheme = "light" | "dark";

// 独自の描画色も Fluent のテーマに含め、入れ子のテーマやポータルへ同じ値を渡す。
type KodouTheme = Theme & {
  chartHr: string;
  chartRr: string;
  themeScheme: ThemeScheme;
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

// Windows のシステムフォントを優先し、日本語と数値も同じテーマで描画する。
// 配色以外のタイポグラフィはライト/ダークで共通にしたいので、上書きを1か所にまとめる。
const fontOverrides: Pick<Theme, "fontFamilyBase" | "fontFamilyNumeric" | "fontFamilyMonospace"> = {
  fontFamilyBase: '"Segoe UI", "Yu Gothic UI", Meiryo, sans-serif',
  fontFamilyNumeric: '"Segoe UI", "Yu Gothic UI", Meiryo, sans-serif',
  fontFamilyMonospace: 'Consolas, "Liberation Mono", monospace',
};

export const kodouThemes: Record<ThemeScheme, KodouTheme> = {
  light: {
    ...webLightTheme, ...fontOverrides,
    chartHr: "#dc3e42", chartRr: "#0090ff", themeScheme: "light",
  },
  dark: {
    ...webDarkTheme, ...fontOverrides,
    chartHr: "#e37d80", chartRr: "#479ef5", themeScheme: "dark",
  },
};
