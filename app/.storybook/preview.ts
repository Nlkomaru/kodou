import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        kodou: { name: "Kodou", value: "#f5f1e6" },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "kodou" },
  },
};

export default preview;
