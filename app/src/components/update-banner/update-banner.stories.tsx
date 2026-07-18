import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import type { UpdateInfo, UpdateStage } from "@/state/updater";
import { updateErrorAtom, updateInfoAtom, updateProgressAtom, updateStageAtom } from "@/state/updater";
import { UpdateBanner } from "./update-banner";

// UpdateBanner は updater 系 atom の表示だけを担うので、
// ストーリーごとに段階を仕込んだ store を Provider で渡す。
function makeStore(stage: UpdateStage, info: UpdateInfo | null, progress: number | null, error: string) {
  const store = createStore();
  store.set(updateStageAtom, stage);
  store.set(updateInfoAtom, info);
  store.set(updateProgressAtom, progress);
  store.set(updateErrorAtom, error);
  return store;
}

const sampleInfo: UpdateInfo = { version: "0.2.0", notes: "OSC 設定の一元管理と BLE 接続状態表示を改善しました。" };

const availableStore = makeStore("available", sampleInfo, null, "");
const downloadingStore = makeStore("downloading", sampleInfo, 0.42, "");
const readyStore = makeStore("ready", sampleInfo, 1, "");
const errorStore = makeStore("error", sampleInfo, null, "ダウンロードに失敗しました: network error");

const meta = {
  title: "App/UpdateBanner",
  component: UpdateBanner,
  parameters: {
    layout: "padded",
  },
  args: {
    onInstall: () => {},
    onRestart: () => {},
    onDismiss: () => {},
  },
} satisfies Meta<typeof UpdateBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Available: Story = {
  decorators: [
    (Story) => (
      <Provider store={availableStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const Downloading: Story = {
  decorators: [
    (Story) => (
      <Provider store={downloadingStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const Ready: Story = {
  decorators: [
    (Story) => (
      <Provider store={readyStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const Failed: Story = {
  decorators: [
    (Story) => (
      <Provider store={errorStore}>
        <Story />
      </Provider>
    ),
  ],
};
