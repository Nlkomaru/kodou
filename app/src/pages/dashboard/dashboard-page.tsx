import { useAtomValue } from "jotai";
import { DataHeader } from "@/components/data-header/data-header";
import { HrChartPanel, type HrChartPanelStats } from "@/components/hr-chart-panel/hr-chart-panel";
import { computeSdnn, computeStats, getWallClockTimeDomain, pointsWithinWindow } from "@/lib/heart-rate";
import { useWallClockNow } from "@/hooks/use-wall-clock-now";
import type { MetricPoint } from "@/lib/heart-rate-types";
import { bpmHistoryAtom, heartRateStatsAtom, readingAtom, rrHistoryAtom, statsWindowMsAtom } from "@/state/heart-rate";
import { StatusMessage } from "@/components/status-message/status-message";

const FIVE_MINUTES_MS = 5 * 60_000;

function formatValue(value: number | null, unit: string) {
  return value == null ? null : `${value} ${unit}`;
}

// RR間隔チャート用の最大・最小・平均。BPM用のcomputeStatsと同じ丸め方に揃える。
function summarizeRr(points: MetricPoint[]) {
  if (points.length === 0) {
    return { max: null, min: null, avg: null } as const;
  }

  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const point of points) {
    sum += point.value;
    if (point.value > max) max = point.value;
    if (point.value < min) min = point.value;
  }

  return {
    max: Math.round(max),
    min: Math.round(min),
    avg: Math.round((sum / points.length) * 10) / 10,
  } as const;
}

export function DashboardPage() {
  const reading = useAtomValue(readingAtom);
  const bpmHistory = useAtomValue(bpmHistoryAtom);
  const rrHistory = useAtomValue(rrHistoryAtom);
  const stats = useAtomValue(heartRateStatsAtom);
  const statsWindowMs = useAtomValue(statsWindowMsAtom);
  // 2つのチャートで同じ時刻を使い、X軸を揃えたまま壁時計で流し続ける。
  const now = useWallClockNow();
  const timeDomain = getWallClockTimeDomain(now);

  const fiveMinuteStats = computeStats(bpmHistory, rrHistory, FIVE_MINUTES_MS);
  const sdnnMs = computeSdnn(rrHistory, statsWindowMs);
  const latestRr = rrHistory.length > 0 ? rrHistory[rrHistory.length - 1].value : null;
  const rrSummary = summarizeRr(pointsWithinWindow(rrHistory, statsWindowMs));

  const hrStats: HrChartPanelStats = {
    max: formatValue(stats.maxBpm, "bpm"),
    min: formatValue(stats.minBpm, "bpm"),
    avg: formatValue(stats.avgBpm, "bpm"),
    avg5min: formatValue(fiveMinuteStats.avgBpm, "bpm"),
    rmssd: formatValue(stats.rmssdMs, "ms"),
    hrv: formatValue(sdnnMs, "ms"),
  };

  const rrStats: HrChartPanelStats = {
    max: formatValue(rrSummary.max, "ms"),
    min: formatValue(rrSummary.min, "ms"),
    avg: formatValue(rrSummary.avg, "ms"),
    avg5min: formatValue(summarizeRr(pointsWithinWindow(rrHistory, FIVE_MINUTES_MS)).avg, "ms"),
    rmssd: formatValue(stats.rmssdMs, "ms"),
    hrv: formatValue(sdnnMs, "ms"),
  };

  return (
    <div className="flex flex-col gap-4">
      <DataHeader bpm={reading?.bpm ?? null} rrMs={latestRr != null ? Math.round(latestRr) : null} />
      <HrChartPanel title="HR" unit="bpm" current={reading?.bpm ?? null} points={bpmHistory} stats={hrStats} timeDomain={timeDomain} />
      <HrChartPanel title="RR-interval" unit="ms" current={latestRr} points={rrHistory} stats={rrStats} color="#0090FF" smooth={false} timeDomain={timeDomain} />
      <StatusMessage />
    </div>
  );
}
