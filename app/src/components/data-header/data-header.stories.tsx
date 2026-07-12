import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataHeader } from "./data-header";

const meta = {
  title: "HeartRate/DataHeader",
  component: DataHeader,
} satisfies Meta<typeof DataHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    bpm: 81,
    rrMs: 81,
  },
};

export const NoData: Story = {
  args: {
    bpm: null,
    rrMs: null,
  },
};
