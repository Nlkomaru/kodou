import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import { useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import type { HeartRateDevice } from "@/lib/heart-rate-types";
import { devicesAtom, selectedDeviceIdAtom } from "@/state/heart-rate";
import type { StartupSettings as StartupSettingsValues } from "@/lib/startup";
import { startupSettingsAtom } from "@/state/startup";
import type { ThemePreference } from "@/lib/theme";
import { themePreferenceAtom } from "@/state/theme";
import { SettingsPage } from "./settings-page";

// 設定画面全体を確認できるようにする。IPC 呼び出しはクリック時だけなので、
// デフォルトの atom と数件のデバイスがあればそのまま描画できる。
function SettingsPageDemo({
  devices,
  selectedId,
  startup,
  theme,
  children,
}: {
  devices: HeartRateDevice[];
  selectedId: string;
  startup: StartupSettingsValues;
  theme: ThemePreference;
  children: ReactNode;
}) {
  const store = useMemo(() => {
    const injected = createStore();
    injected.set(devicesAtom, devices);
    injected.set(selectedDeviceIdAtom, selectedId);
    injected.set(startupSettingsAtom, startup);
    injected.set(themePreferenceAtom, theme);
    return injected;
  }, [devices, selectedId, startup, theme]);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <div className="w-[46rem] p-6">{children}</div>
      </ThemeProvider>
    </Provider>
  );
}

const meta = {
  title: "Settings/SettingsPage",
  component: SettingsPage,
} satisfies Meta<typeof SettingsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const DEVICES: HeartRateDevice[] = [
  { id: "dev-0", name: "Polar H10", address: "AA:BB:CC:DD:EE:00", rssi: -42, services: [] },
  { id: "dev-1", name: "HRM-Dual", address: "AA:BB:CC:DD:EE:01", rssi: -55, services: [] },
];

const STARTUP: StartupSettingsValues = { autoConnect: true, restoreStoppedState: true };

// デバイス選択済み・起動設定もONの既定状態。
export const Default: Story = {
  decorators: [
    (Story) => (
      <SettingsPageDemo devices={DEVICES} selectedId="dev-0" startup={STARTUP} theme="system">
        <Story />
      </SettingsPageDemo>
    ),
  ],
};

// ダーク配色での見た目を確認する状態。
export const Dark: Story = {
  decorators: [
    (Story) => (
      <SettingsPageDemo devices={DEVICES} selectedId="dev-0" startup={STARTUP} theme="dark">
        <Story />
      </SettingsPageDemo>
    ),
  ],
};
