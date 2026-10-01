import { Card, CardHeader, Text } from "@fluentui/react-components";
import { Controls } from "./controls";
import { DevicePicker } from "./device-picker";

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
            <Text size={200}>接続したデバイスは記憶され、次回起動時に自動で再接続します。</Text>
          }
        />
        <div className="flex flex-col gap-4">
          <DevicePicker />
          <Controls />
        </div>
      </Card>
    </div>
  );
}
