import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OscAddressMap } from "@/lib/osc";
import { OscParamAddressList } from "./osc-param-address-list";

// 一部のパラメータだけアドレスを設定した、実運用に近い状態。
const CONFIGURED: OscAddressMap = {
  connected: ["/avatar/parameters/HeartRateConnected"],
  hr: ["/avatar/parameters/HR"],
  hrAverage: ["/avatar/parameters/HRAverage"],
  beatToggle: ["/avatar/parameters/HeartBeatToggle"],
};

const meta = {
  title: "OSC/OscParamAddressList",
  component: OscParamAddressList,
  parameters: { layout: "padded" },
  args: {
    onAdd: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof OscParamAddressList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Configured: Story = {
  args: { addresses: CONFIGURED },
};

export const Empty: Story = {
  args: { addresses: {} },
};
