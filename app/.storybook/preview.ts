import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
import { FluentProvider } from "@fluentui/react-components";
import { kodouTheme } from "../src/lib/theme";
import "../src/index.css";

const preview: Preview = {
  decorators: [
    (Story) => createElement(FluentProvider, { theme: kodouTheme }, createElement(Story)),
  ],
  parameters: {
    backgrounds: {
      options: {
        kodou: { name: "Fluent Light", value: "#fafafa" },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "kodou" },
  },
};

export default preview;
