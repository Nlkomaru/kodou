import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import type { HeartRateDevice } from "@/lib/heart-rate-types";
import { devicesAtom, selectedDeviceIdAtom } from "@/state/heart-rate";
import { DevicePicker } from "./device-picker";

// 実機のスキャン結果に近づけるため、長い名前と短い名前を混ぜた一覧を用意する。
// ドロップダウンがスクロールする件数にしておくと、開いたときの見え方を確認しやすい。
const devices: HeartRateDevice[] = Array.from({ length: 12 }, (_, i) => ({
  id: `dev-${i}`,
  name: i % 3 === 0 ? `Polar H10 ${i} とても長いデバイス名のケース` : `HRM-Dual ${i}`,
  address: `AA:BB:CC:DD:EE:${String(i).padStart(2, "0")}`,
  rssi: -40 - i,
  services: [],
}));

// DevicePicker は Jotai の atom を参照するため、値を仕込んだ store を Provider で渡す。
function makeStore(deviceList: HeartRateDevice[], selectedId: string) {
  const store = createStore();
  store.set(devicesAtom, deviceList);
  store.set(selectedDeviceIdAtom, selectedId);
  return store;
}

const meta = {
  title: "Settings/DevicePicker",
  component: DevicePicker,
} satisfies Meta<typeof DevicePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

// 多数のデバイスが見つかった状態。ドロップダウンの余白とスクロールの確認用。
export const ManyDevices: Story = {
  decorators: [
    (Story) => (
      <Provider store={makeStore(devices, "dev-9")}>
        <div className="w-[28rem] p-6">
          <Story />
        </div>
      </Provider>
    ),
  ],
};

// デバイスが1台も見つかっていない状態（トリガーは disabled になる）。
export const NoDevices: Story = {
  decorators: [
    (Story) => (
      <Provider store={makeStore([], "")}>
        <div className="w-[28rem] p-6">
          <Story />
        </div>
      </Provider>
    ),
  ],
};
