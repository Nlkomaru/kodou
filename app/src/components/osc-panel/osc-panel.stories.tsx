import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import type { AppConfig } from "@/lib/osc";
import { oscConfigAtom, oscEnabledAtom } from "@/state/osc";
import { OscPanel } from "./osc-panel";

// OscPanel は Jotai の設定 atom を参照するため、ストーリーごとに値を仕込んだ
// store を用意して Provider で渡す。実体の設定は oscConfigAtom 1つに集約されている。
function makeStore(config: AppConfig, enabled: boolean) {
  const store = createStore();
  store.set(oscConfigAtom, config);
  store.set(oscEnabledAtom, enabled);
  return store;
}

// osc セクションの数値設定はパネル表示に影響しないため、共通の既定値を使い回す。
const OSC_SETTINGS: AppConfig["osc"] = {
  targets: [],
  bpmMin: 0,
  bpmMax: 240,
  hrFloatMode: "signed",
  averageWindowMs: 10_000,
  beatPulseMs: 120,
  rrTwitchThresholdMs: 50,
  disconnectTimeoutSecs: 60,
};

// 送信先とパラメータが設定済みの状態。
const CONFIGURED: AppConfig = {
  osc: { ...OSC_SETTINGS, targets: ["127.0.0.1:9000", "127.0.0.1:9001"] },
  compatibility: {
    connected: ["/avatar/parameters/HeartRateConnected"],
    hr: ["/avatar/parameters/HR"],
    hrAverage: ["/avatar/parameters/HRAverage"],
    beatToggle: ["/avatar/parameters/HeartBeatToggle"],
  },
};

// config.conf 未設定で、送信先もパラメータも空の状態。
const EMPTY: AppConfig = {
  osc: OSC_SETTINGS,
  compatibility: {},
};

// interaction で ON/OFF を保持できるよう、store はモジュールスコープで一度だけ作る。
const configuredStore = makeStore(CONFIGURED, true);
const emptyStore = makeStore(EMPTY, false);

const meta = {
  title: "OSC/OscPanel",
  component: OscPanel,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof OscPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Configured: Story = {
  decorators: [
    (Story) => (
      <Provider store={configuredStore}>
        <Story />
      </Provider>
    ),
  ],
};

export const Empty: Story = {
  decorators: [
    (Story) => (
      <Provider store={emptyStore}>
        <Story />
      </Provider>
    ),
  ],
};
