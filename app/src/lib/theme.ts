import { webLightTheme, type Theme } from "@fluentui/react-components";

// Windows のシステムフォントを優先し、日本語と数値も同じテーマで描画する。
export const kodouTheme: Theme = {
  ...webLightTheme,
  fontFamilyBase: '"Segoe UI", "Yu Gothic UI", Meiryo, sans-serif',
  fontFamilyNumeric: '"Segoe UI", "Yu Gothic UI", Meiryo, sans-serif',
  fontFamilyMonospace: 'Consolas, "Liberation Mono", monospace',
};
