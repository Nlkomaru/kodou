import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import { useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { themePreferenceAtom } from "@/state/theme";
import { ThemeSelector } from "./theme-selector";

// 保存済みの設定を仕込んだJotaiストアを用意し、選択操作が実際にテーマへ反映される様子を確認できるようにする。
function PreferencesDemo({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const store = useMemo(() => {
    const injected = createStore();
    injected.set(themePreferenceAtom, preference);
    return injected;
  }, [preference]);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <div className="w-[28rem] p-6">{children}</div>
      </ThemeProvider>
    </Provider>
  );
}

const meta = {
  title: "Settings/ThemeSelector",
  component: ThemeSelector,
} satisfies Meta<typeof ThemeSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

// OSの設定に追従する状態。ストーリーのツールバーでOS側の配色を切り替えると表示も変わる。
export const System: Story = {
  decorators: [
    (Story) => (
      <PreferencesDemo preference="system">
        <Story />
      </PreferencesDemo>
    ),
  ],
};

// 常にライト配色を選んでいる状態。
export const Light: Story = {
  decorators: [
    (Story) => (
      <PreferencesDemo preference="light">
        <Story />
      </PreferencesDemo>
    ),
  ],
};

// 常にダーク配色を選んでいる状態。
export const Dark: Story = {
  decorators: [
    (Story) => (
      <PreferencesDemo preference="dark">
        <Story />
      </PreferencesDemo>
    ),
  ],
};
