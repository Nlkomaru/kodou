import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecordingList } from "./recording-list";

const meta = {
  title: "HeartRate/RecordingList",
  component: RecordingList,
  args: {
    onReveal: (path: string) => console.log("reveal", path),
  },
} satisfies Meta<typeof RecordingList>;

export default meta;

type Story = StoryObj<typeof meta>;

const recordings = [
  {
    path: "C:\\Users\\kodou\\AppData\\Roaming\\kodou\\recordings\\2026-07\\2026-07-15_2.parquet",
    name: "2026-07-15_2.parquet",
    date: "2026-07-15",
    sequence: 2,
    sizeBytes: 12_400,
    modifiedMs: new Date("2026-07-15T22:41:00").getTime(),
  },
  {
    path: "C:\\Users\\kodou\\AppData\\Roaming\\kodou\\recordings\\2026-07\\2026-07-15_1.parquet",
    name: "2026-07-15_1.parquet",
    date: "2026-07-15",
    sequence: 1,
    sizeBytes: 843_000,
    modifiedMs: new Date("2026-07-15T20:05:00").getTime(),
  },
  {
    path: "C:\\Users\\kodou\\AppData\\Roaming\\kodou\\recordings\\2026-07\\2026-07-14_1.parquet",
    name: "2026-07-14_1.parquet",
    date: "2026-07-14",
    sequence: 1,
    sizeBytes: 2_310_000,
    modifiedMs: new Date("2026-07-14T23:58:00").getTime(),
  },
];

export const Default: Story = {
  args: {
    recordings,
  },
};

// 記録中のファイルは一覧の先頭に「記録中」バッジ付きで並ぶ。
export const Recording: Story = {
  args: {
    recordings,
    activePath: recordings[0].path,
  },
};

export const Empty: Story = {
  args: {
    recordings: [],
  },
};
