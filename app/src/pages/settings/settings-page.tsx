import { Card, CardHeader, Text } from "@fluentui/react-components";
import { Controls } from "./controls";
import { DevicePicker } from "./device-picker";
import { StartupSettings } from "./startup-settings";
import { ThemeSelector } from "./theme-selector";

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card appearance="outline" size="large">
        <CardHeader
          header={
            <Text size={400} weight="semibold">
              デバイス接続
            </Text>
          }
          description={
            <Text size={200}>接続したデバイスは記憶され、次回起動時の自動接続に使われます。自動接続の設定は「起動時」で変更できます。</Text>
          }
        />
        <div className="flex flex-col gap-4">
          <DevicePicker />
          <Controls />
        </div>
      </Card>
      <Card appearance="outline" size="large">
        <CardHeader
          header={
            <Text size={400} weight="semibold">
              起動時
            </Text>
          }
          description={
            <Text size={200}>アプリ起動時に心拍センサーへ自動で接続するかどうかを設定します。</Text>
          }
        />
        <StartupSettings />
      </Card>
      <Card appearance="outline" size="large">
        <CardHeader
          header={
            <Text size={400} weight="semibold">
              テーマ
            </Text>
          }
          description={
            <Text size={200}>アプリ全体の配色を選択します。選択内容は次回起動時にも引き継がれます。</Text>
          }
        />
        <ThemeSelector />
      </Card>
    </div>
  );
}
