import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Toaster } from "@fluentui/react-components";
import { STATUS_TOASTER_ID, useNotification } from "@/hooks/use-notification";

// アプリと同じ通知経路で、差し替えとエラー表示を確認する。
function NotificationsDemo() {
  const notify = useNotification();
  return (
    <div className="flex gap-2">
      <Button onClick={() => notify("Bluetooth 心拍センサーに接続しました。", "demo-status")}>
        通常のトースト
      </Button>
      <Button onClick={() => notify("再接続しています。", "demo-status")}>
        状態を更新
      </Button>
      <Button appearance="subtle" onClick={() => notify("デバイスへの接続に失敗しました。", "demo-error", "error")}>
        エラーのトースト
      </Button>
      <Toaster toasterId={STATUS_TOASTER_ID} position="bottom-end" />
    </div>
  );
}

const meta = {
  title: "UI/Notifications",
  component: NotificationsDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof NotificationsDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
