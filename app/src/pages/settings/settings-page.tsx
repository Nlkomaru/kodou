import { Divider } from "@fluentui/react-components";
import { Section } from "@/components/section/section";
import { Controls } from "./controls";
import { DevicePicker } from "./device-picker";
import { StartupSettings } from "./startup-settings";
import { ThemeSelector } from "./theme-selector";

// 設定は枠で囲わず、見出しと区切り線でまとめて縦に並べる。
// 幅を制限し、どこまでが1つの設定なのかが読み取りやすい行長に揃える。
export function SettingsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Section
        label="デバイス接続"
        description="接続したデバイスは記憶され、次回起動時の自動接続に使われます。自動接続の設定は「起動時」で変更できます。"
      >
        <DevicePicker />
        <Controls />
      </Section>

      <Divider />

      <Section
        label="起動時"
        description="アプリ起動時に心拍センサーへ自動で接続するかどうかを設定します。"
      >
        <StartupSettings />
      </Section>

      <Divider />

      <Section
        label="テーマ"
        description="アプリ全体の配色を選択します。システムを選ぶとOSの設定に追従し、選択内容は次回起動時にも引き継がれます。"
      >
        <ThemeSelector />
      </Section>
    </div>
  );
}
