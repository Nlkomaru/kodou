import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "./sonner";

// Toaster は自前でテーマ変数を指定しているため、実際の見た目をここで確認できるようにする。
// 状態通知（useStatusToast）が出すトーストと同じ2種類を並べる。
function ToasterDemo() {
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast("Bluetooth 心拍センサーに接続しました。", { id: "demo-status" })}>
        通常のトースト
      </Button>
      <Button
        variant="ghost"
        onClick={() => toast.error("デバイスへの接続に失敗しました。", { id: "demo-error" })}
      >
        エラーのトースト
      </Button>
      <Toaster />
    </div>
  );
}

const meta = {
  title: "UI/Toaster",
  component: ToasterDemo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ToasterDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
