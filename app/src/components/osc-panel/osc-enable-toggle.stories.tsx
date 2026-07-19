import type { Meta, StoryObj } from "@storybook/react-vite";
import { OscEnableToggle } from "./osc-enable-toggle";

const meta = {
  title: "OSC/OscEnableToggle",
  component: OscEnableToggle,
  parameters: { layout: "centered" },
  args: { onCheckedChange: () => {} },
} satisfies Meta<typeof OscEnableToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: { checked: true },
};

export const Disabled: Story = {
  args: { checked: false },
};
