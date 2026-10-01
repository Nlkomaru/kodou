import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
import { ThemeProvider } from "../src/components/theme-provider/theme-provider";
import type { ThemePreference } from "../src/lib/theme";
import "../src/index.css";

const preview: Preview = {
  // ツールバーでシステム/ライト/ダークを切り替える。systemはOS設定に追従する。
  globalTypes: {
    theme: {
      description: "配色テーマ",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "system", title: "システム" },
          { value: "light", title: "ライト" },
          { value: "dark", title: "ダーク" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "system",
    backgrounds: { value: "kodou" },
  },
  // preference を渡してテーマを切り替えるため、アプリの保存設定（localStorage）には書き込まない。
  decorators: [
    (Story, context) =>
      createElement(
        ThemeProvider,
        { preference: context.globals.theme as ThemePreference | undefined },
        createElement(Story),
      ),
  ],
  parameters: {
    backgrounds: {
      options: {
        kodou: { name: "Fluent Light", value: "#fafafa" },
      },
    },
  },
};

export default preview;
