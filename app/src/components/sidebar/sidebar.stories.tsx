import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar } from "./sidebar";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "720px", display: "flex" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  args: {
    connected: true,
    activeItem: "dashboard",
    battery: "90%",
    sensorContact: "不明",
    energy: "未取得",
  },
};

export const Disconnected: Story = {
  args: {
    connected: false,
    activeItem: "dashboard",
  },
};
