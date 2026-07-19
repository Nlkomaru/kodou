import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Controls } from "./controls";
import { DevicePicker } from "./device-picker";

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>デバイス接続</CardTitle>
          <CardDescription>
            接続したデバイスは記憶され、次回起動時に自動で再接続します。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DevicePicker />
          <Controls />
        </CardContent>
      </Card>
    </div>
  );
}
