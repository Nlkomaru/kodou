import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import { useMemo, type ReactNode } from "react";
import type { StartupSettings as StartupSettingsValues } from "@/lib/startup";
import { startupSettingsAtom } from "@/state/startup";
import { StartupSettings } from "./startup-settings";

// 保存済みの設定を仕込んだプライベートなJotaiストアを用意し、
// 各スイッチの状態と依存関係（自動接続OFF時の引き継ぎスイッチ無効化）を確認できるようにする。
function StartupSettingsDemo({
  settings,
  children,
}: {
  settings: StartupSettingsValues;
  children: ReactNode;
}) {
  const store = useMemo(() => {
    const injected = createStore();
    injected.set(startupSettingsAtom, settings);
    return injected;
  }, [settings]);

  return (
    <Provider store={store}>
      <div className="w-[28rem] p-6">{children}</div>
    </Provider>
  );
}

const meta = {
  title: "Settings/StartupSettings",
  component: StartupSettings,
} satisfies Meta<typeof StartupSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

// 既定の状態。自動接続も停止状態の引き継ぎも有効。
export const DefaultBothOn: Story = {
  decorators: [
    (Story) => (
      <StartupSettingsDemo settings={{ autoConnect: true, restoreStoppedState: true }}>
        <Story />
      </StartupSettingsDemo>
    ),
  ],
};

// 常に接続する状態。停止状態を引き継がないので、前回停止していても起動時に接続する。
export const AlwaysConnect: Story = {
  decorators: [
    (Story) => (
      <StartupSettingsDemo settings={{ autoConnect: true, restoreStoppedState: false }}>
        <Story />
      </StartupSettingsDemo>
    ),
  ],
};

// 自動接続を無効化した状態。依存する引き継ぎスイッチは無効化されるが、ONの選択値は保持される。
export const AutoConnectDisabled: Story = {
  decorators: [
    (Story) => (
      <StartupSettingsDemo settings={{ autoConnect: false, restoreStoppedState: true }}>
        <Story />
      </StartupSettingsDemo>
    ),
  ],
};
