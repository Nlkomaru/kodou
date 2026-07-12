import type { HeartRateStats, MetricPoint, TimeDomain } from "./heart-rate-types";

export const HISTORY_LIMIT = 96;
export const CHART_WINDOW_MS = 60_000;

// チャート表示と保持する状態がずれないように、直近1分の範囲だけ残す。
export function appendHistory(current: MetricPoint[], next: MetricPoint[]) {
  const combined = [...current, ...next];
  const newestTimestamp = Math.max(...combined.map((point) => point.timestamp));

  return combined
    .filter((point) => point.timestamp >= newestTimestamp - CHART_WINDOW_MS)
    .slice(-HISTORY_LIMIT);
}

// BLEパケットには複数のRR間隔が含まれることがある。
// 通知時刻を最新intervalの終端として扱い、古いintervalは時間をさかのぼって配置する。
export function rrIntervalsToPoints(endTimestamp: number, intervalsMs: number[]) {
  const points: MetricPoint[] = [];
  let cursor = endTimestamp;

  for (let index = intervalsMs.length - 1; index >= 0; index -= 1) {
    points.push({
      timestamp: cursor,
      value: intervalsMs[index],
    });
    cursor -= intervalsMs[index];
  }

  return points.reverse();
}

// BPMとRRのチャートで同じ時間範囲を使い、X軸を揃える。
// データの実測範囲ではなく常に直近1分の固定窓を返すことで、
// データが1分未満でも軸が縮まず(足りない)、系列ごとに終端がずれても
// 描画がはみ出さない(オーバーフローしない)ようにする。
export function getSyncedTimeDomain(...series: MetricPoint[][]): TimeDomain | null {
  const timestamps = series.flatMap((points) => points.map((point) => point.timestamp));

  if (timestamps.length === 0) {
    return null;
  }

  const maxTimestamp = Math.max(...timestamps);

  return {
    start: maxTimestamp - CHART_WINDOW_MS,
    end: maxTimestamp,
  };
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// 心拍統計は heart-rate-types で型定義し、ここでは計算関数だけ持つ。変換は `computeStats` で行う。
// 指定時間窓内のBPM履歴だけ取り出す。履歴はすでに時系列に並んでいる前提。
export function pointsWithinWindow(points: MetricPoint[], windowMs: number): MetricPoint[] {
  if (points.length === 0) return points;
  const newest = points[points.length - 1].timestamp;
  const threshold = newest - windowMs;
  return points.filter((point) => point.timestamp >= threshold);
}

// 指定時間窓内のBPM平均・最大・最小と、RR間隔のRMSSDを算出する。
// HRVとしてはRMSSD(root mean square of successive differences)が扱いやすく、
// 過少なサンプルで明らかに意味のない値を出さないよう最低4個のRR値を要求する。
export function computeStats(
  bpmHistory: MetricPoint[],
  rrHistory: MetricPoint[],
  windowMs: number,
): HeartRateStats {
  const bpmPoints = pointsWithinWindow(bpmHistory, windowMs);

  let avgBpm: number | null = null;
  let maxBpm: number | null = null;
  let minBpm: number | null = null;

  if (bpmPoints.length > 0) {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    for (const point of bpmPoints) {
      sum += point.value;
      if (point.value > max) max = point.value;
      if (point.value < min) min = point.value;
    }
    avgBpm = Math.round((sum / bpmPoints.length) * 10) / 10;
    maxBpm = Math.round(max);
    minBpm = Math.round(min);
  }

  const rrPoints = pointsWithinWindow(rrHistory, windowMs)
    .map((point) => point.value)
    .filter((value) => value > 0);

  let rmssdMs: number | null = null;
  if (rrPoints.length >= 4) {
    let squaredSum = 0;
    let count = 0;
    for (let index = 1; index < rrPoints.length; index += 1) {
      const difference = rrPoints[index] - rrPoints[index - 1];
      squaredSum += difference * difference;
      count += 1;
    }
    if (count > 0) {
      rmssdMs = Math.round(Math.sqrt(squaredSum / count) * 10) / 10;
    }
  }

  return {
    avgBpm,
    maxBpm,
    minBpm,
    rmssdMs,
  };
}

// HRV指標としてSDNN(RR間隔の標準偏差)を算出する。
// RMSSDと同じく、過少なサンプルで意味のない値を出さないよう最低4個のRR値を要求する。
export function computeSdnn(rrHistory: MetricPoint[], windowMs: number): number | null {
  const rrValues = pointsWithinWindow(rrHistory, windowMs)
    .map((point) => point.value)
    .filter((value) => value > 0);

  if (rrValues.length < 4) return null;

  const mean = rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length;
  const variance = rrValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rrValues.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}
