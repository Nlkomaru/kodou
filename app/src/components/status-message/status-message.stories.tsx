import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import type { HeartRateStatusEvent } from "@/lib/heart-rate-types";
import { errorAtom, statusAtom } from "@/state/heart-rate";
import { StatusMessage } from "./status-message";

// StatusMessage は status / error atom を表示するだけなので、
// ストーリーごとに値を仕込んだ store を Provider で渡す。
function makeStore(status: HeartRateStatusEvent, error: string) {
  const store = createStore();
  store.set(statusAtom, status);
  store.set(errorAtom, error);
  return store;
}

const connectedStore = makeStore(
  { state: "connected", message: "心拍センサーに接続しました。", deviceId: "HRM-1234" },
  "",
);

const scanningStore = makeStore(
  { state: "scanning", message: "心拍センサーを探しています…", deviceId: null },
  "",
);

// status に加えて error も表示される状態。
const errorStore = makeStore(
  { state: "error", message: "接続が切断されました。", deviceId: null },
  "デバイスへの再接続に失敗しました。",
);

const meta = {
  title: "HeartRate/StatusMessage",
  component: StatusMessage,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StatusMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  decorators: [
    (Story) => (
      <Provider store={connectedStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const Scanning: Story = {
  decorators: [
    (Story) => (
      <Provider store={scanningStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const WithError: Story = {
  decorators: [
    (Story) => (
      <Provider store={errorStore}>
        <Story />
      </Provider>
    ),
  ],
};
