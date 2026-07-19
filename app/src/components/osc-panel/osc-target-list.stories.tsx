import type { Meta, StoryObj } from "@storybook/react-vite";
import { OscTargetList } from "./osc-target-list";

// 送信先リストは props だけで完結するため、Jotai の Provider を用意する必要はない。
const meta = {
  title: "OSC/OscTargetList",
  component: OscTargetList,
  parameters: { layout: "padded" },
  args: {
    onAdd: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof OscTargetList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithTargets: Story = {
  args: { targets: ["127.0.0.1:9000", "192.168.1.20:9000"] },
};

export const Empty: Story = {
  args: { targets: [] },
};
