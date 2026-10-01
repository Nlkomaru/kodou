import { useEffect, useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { getWallClockTimeDomain } from "@/lib/heart-rate";
import type { MetricPoint } from "@/lib/heart-rate-types";
import { HrChartPanel, type HrChartPanelStats } from "./hr-chart-panel";

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

// ストーリー共通の統計表示。値の並びから最大・最小・平均を丸めて出し、HRV系は固定値にする。
function statsFrom(values: number[]): HrChartPanelStats {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    max: `${max.toFixed(1)} bpm`,
    min: `${min.toFixed(1)} bpm`,
    avg: `${avg.toFixed(1)} bpm`,
    avg5min: `${avg.toFixed(1)} bpm`,
    rmssd: "40.8 ms",
    hrv: "32 ms",
  };
}

const EMPTY_STATS: HrChartPanelStats = {
  max: null,
  min: null,
  avg: null,
  avg5min: null,
  rmssd: null,
  hrv: null,
};

const points = samplePoints(60);
const values = points.map((point) => point.value);
const latestValue = Math.round(values[values.length - 1]);
const lastTimestamp = points[points.length - 1].timestamp;

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
    current: latestValue,
    points,
    stats: statsFrom(values),
  },
};

// 時間窓(50秒)より広い118秒分のデータを、窓の内側で両端とも切る。
// 窓の外へ出た隣接サンプルをスプライン・平滑化にだけ使うため、端が跳ねずに滑らかに出入りする。
export const EdgeClipped: Story = {
  args: {
    current: latestValue,
    points,
    timeDomain: { start: points[20].timestamp, end: points[45].timestamp },
    stats: statsFrom(values),
  },
};

// smooth=false は生の値で描く(RR間隔チャートで使う設定)。
export const RawValues: Story = {
  args: {
    current: latestValue,
    points,
    smooth: false,
    stats: statsFrom(values),
  },
};

// BLEデータが20秒前で途切れたまま、壁時計の時間軸だけが進んでいる状態。
// 途切れた後は塗りも帯も文字も置かず、そのまま空白になる。
const stalePoints = points.slice(-20);
const staleEnd = stalePoints[stalePoints.length - 1].timestamp;

export const StaleData: Story = {
  args: {
    current: latestValue,
    points: stalePoints,
    timeDomain: { start: staleEnd - 40_000, end: staleEnd + 20_000 },
    stats: statsFrom(values),
  },
};

// さらに時間が進み、最後のデータが窓の外へ完全に流れ去った状態。
// データは消えるが、壁時計の時刻目盛りだけは流れ続ける。
export const StaleDataScrolledOff: Story = {
  args: {
    current: latestValue,
    points: stalePoints,
    timeDomain: { start: staleEnd + 5_000, end: staleEnd + 65_000 },
    stats: statsFrom(values),
  },
};

// 計測開始直後でデータが1件も無い状態。プロットは空白のままだが、壁時計の時間軸は動き続ける。
export const EmptyWithTimeDomain: Story = {
  args: {
    current: null,
    points: [],
    timeDomain: { start: lastTimestamp - 60_000, end: lastTimestamp },
    stats: EMPTY_STATS,
  },
};

// 時間窓が無い静的な空表示。プロットも軸も描かれず、真っ白なSVGだけが残る。
export const Empty: Story = {
  args: {
    current: null,
    points: [],
    stats: EMPTY_STATS,
  },
};

// 凍結したサンプル列を実時間と同じ1秒刻みで左へ流すデモ。
// データは初期時点で止まっているため、窓が進むほど左へ寄り、約1分で完全に消える。
// ブラウザで開くと「古いデータが左へ流れて空白に消える」挙動をそのまま確認できる。
const movingPoints = points.slice(-20);

function MovingStaleDataDemo(props: ComponentProps<typeof HrChartPanel>) {
  const [now, setNow] = useState(() => staleEnd + 5_000);

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1_000), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <HrChartPanel
      {...props}
      timeDomain={getWallClockTimeDomain(now)}
    />
  );
}

export const MovingStaleData: Story = {
  args: { current: latestValue, points: movingPoints, stats: statsFrom(values) },
  render: (args) => <MovingStaleDataDemo {...args} />,
};

// 狭い幅でもカードからはみ出さないこと(ラベル・統計・グラフ)を確認する。
export const NarrowWidth: Story = {
  args: {
    current: latestValue,
    points,
    stats: statsFrom(values),
    timeDomain: { start: points[20].timestamp, end: points[45].timestamp },
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <HrChartPanel {...args} />
    </div>
  ),
};
