import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "@fluentui/react-components";
import { Radio, Send } from "lucide-react";
import { Section } from "./section";

// 枠を使わずに見出しと余白でまとまる様子を、ページ見出しとまとまりの2階層で示す。
const meta = {
  title: "Layout/Section",
  component: Section,
  parameters: { layout: "padded" },
  args: {
    label: "送信先",
    icon: Send,
  },
} satisfies Meta<typeof Section>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDescriptionAndCount: Story = {
  args: {
    label: "送信パラメータ",
    icon: Radio,
    count: 4,
    description: "アドレスを1つも設定しないパラメータは送信されません。",
    children: <p className="text-sm text-secondary-foreground">内容はここに入る。</p>,
  },
};

export const PageHeadingWithAction: Story = {
  args: {
    level: 1,
    label: "OSC送信",
    description: "VRChatのAvatar Parameter OSCへ心拍データを送ります",
    action: <Switch defaultChecked label="送信を有効化" />,
    children: <p className="text-sm text-secondary-foreground">ページ全体の内容がここに入る。</p>,
  },
};
