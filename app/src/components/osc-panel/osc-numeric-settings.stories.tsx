import type { Meta, StoryObj } from "@storybook/react-vite";
import { FALLBACK_CONFIG } from "@/lib/osc";
import { OscNumericSettings } from "./osc-numeric-settings";

const meta = {
  title: "OSC/OscNumericSettings",
  component: OscNumericSettings,
  parameters: { layout: "padded" },
  args: {
    settings: FALLBACK_CONFIG.osc,
    onChange: () => {},
  },
} satisfies Meta<typeof OscNumericSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// 自動停止を 0 にして「無効」を表す状態。
export const AutoStopDisabled: Story = {
  args: {
    settings: { ...FALLBACK_CONFIG.osc, disconnectTimeoutSecs: 0 },
  },
};
