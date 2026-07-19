import type { Meta, StoryObj } from "@storybook/react-vite";
import { OscFloatModeSelect } from "./osc-float-mode-select";

const meta = {
  title: "OSC/OscFloatModeSelect",
  component: OscFloatModeSelect,
  parameters: { layout: "padded" },
  args: { onChange: () => {} },
} satisfies Meta<typeof OscFloatModeSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Signed: Story = {
  args: { value: "signed" },
};

export const Unsigned: Story = {
  args: { value: "unsigned" },
};
