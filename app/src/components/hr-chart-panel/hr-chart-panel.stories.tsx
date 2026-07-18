import type { Meta, StoryObj } from "@storybook/react-vite";
import type { MetricPoint } from "@/lib/heart-rate-types";
import { HrChartPanel } from "./hr-chart-panel";

// 固定シードの疑似乱数で、デザインに近い79〜87 bpm付近の波形を決定論的に生成する。
function samplePoints(count: number): MetricPoint[] {
  const start = new Date(2026, 0, 1, 17, 37, 45).getTime();
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({
    timestamp: start + index * 2000,
    value: 82 + Math.sin(index / 6) * 2.2 + Math.sin(index / 2.3) * 0.8 + (random() - 0.5) * 1.4,
  }));
}

const points = samplePoints(60);
const values = points.map((point) => point.value);
const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

const meta = {
  title: "HeartRate/HrChartPanel",
  component: HrChartPanel,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof HrChartPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    current: Math.round(values[values.length - 1]),
    points,
    stats: {
      max: `${Math.max(...values).toFixed(1)} bpm`,
      min: `${Math.min(...values).toFixed(1)} bpm`,
      avg: `${avg.toFixed(1)} bpm`,
      avg5min: `${avg.toFixed(1)} bpm`,
      rmssd: "40.8 ms",
      hrv: "32 ms",
    },
  },
};

// BLEデータが20秒前で途切れたまま、壁時計の時間軸だけが進んでいる状態。
// 実アプリではこの窓が毎秒更新され、空白区間が右へ広がっていく。
const gapPoints = points.slice(-20);
const gapEnd = gapPoints[gapPoints.length - 1].timestamp + 20_000;

export const DataGap: Story = {
  args: {
    current: Math.round(values[values.length - 1]),
    points: gapPoints,
    timeDomain: { start: gapEnd - 60_000, end: gapEnd },
    stats: {
      max: `${Math.max(...values).toFixed(1)} bpm`,
      min: `${Math.min(...values).toFixed(1)} bpm`,
      avg: `${avg.toFixed(1)} bpm`,
      avg5min: `${avg.toFixed(1)} bpm`,
      rmssd: "40.8 ms",
      hrv: "32 ms",
    },
  },
};

export const Empty: Story = {
  args: {
    current: null,
    points: [],
    stats: {
      max: null,
      min: null,
      avg: null,
      avg5min: null,
      rmssd: null,
      hrv: null,
    },
  },
};
