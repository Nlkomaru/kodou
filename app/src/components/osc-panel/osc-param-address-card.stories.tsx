import type { Meta, StoryObj } from "@storybook/react-vite";
import { OSC_PARAM_META } from "@/lib/osc";
import { OscParamAddressCard } from "./osc-param-address-card";

// 代表として HR パラメータを使う。表示ロジックはキーに依存しない。
const HR_META = OSC_PARAM_META.find((meta) => meta.key === "hr")!;

const meta = {
  title: "OSC/OscParamAddressCard",
  component: OscParamAddressCard,
  parameters: { layout: "centered" },
  args: {
    meta: HR_META,
    onAdd: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof OscParamAddressCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithAddresses: Story = {
  args: { addresses: ["/avatar/parameters/HR", "/avatar/parameters/onez/HR"] },
};

export const Unconfigured: Story = {
  args: { addresses: [] },
};
