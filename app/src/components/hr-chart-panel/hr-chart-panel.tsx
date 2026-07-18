import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime, pointsWithinDomain } from "@/lib/heart-rate";
import type { MetricPoint, TimeDomain } from "@/lib/heart-rate-types";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 10, right: 8, bottom: 22, left: 28 };
const X_TICK_INTERVAL_MS = 10_000;
// この時間より長くデータが来ていなければ「データなし」区間として描く。
// BLE通知はおよそ1秒間隔なので、通常の揺らぎを空白と誤認しない程度に余裕を持たせる。
const GAP_THRESHOLD_MS = 3_000;

export type HrChartPanelStats = {
  max: string | null;
  min: string | null;
  avg: string | null;
  avg5min: string | null;
  rmssd: string | null;
  hrv: string | null;
};

type HrChartPanelProps = {
  title?: string;
  unit?: string;
  current: number | null;
  points: MetricPoint[];
  stats: HrChartPanelStats;
  color?: string;
  smooth?: boolean;
  /**
   * X軸に使う時間範囲。壁時計基準の窓を渡すと、データが途切れても軸が流れ続け、
   * 受信できていない区間が空白として表示される。
   * 省略した場合はデータの実測範囲を使う(静的な表示・Storybook向け)。
   */
  timeDomain?: TimeDomain;
};

const STAT_LABELS: { key: keyof HrChartPanelStats; label: string }[] = [
  { key: "max", label: "最大" },
  { key: "min", label: "最小" },
  { key: "avg", label: "平均" },
  { key: "avg5min", label: "5分平均" },
  { key: "rmssd", label: "RMSSD" },
  { key: "hrv", label: "HRV" },
];

// 描画用に値を重み付き移動平均(ガウス風 1:2:3:2:1)でならす。
// 統計値は生データから計算するため、ここでの平滑化は見た目にだけ影響する。
const SMOOTHING_WEIGHTS = [1, 2, 3, 2, 1];

function smoothValues(points: MetricPoint[]): MetricPoint[] {
  if (points.length < 3) return points;

  const half = Math.floor(SMOOTHING_WEIGHTS.length / 2);
  return points.map((point, index) => {
    let weightedSum = 0;
    let totalWeight = 0;
    for (let offset = -half; offset <= half; offset += 1) {
      const neighbor = points[index + offset];
      if (!neighbor) continue;
      const weight = SMOOTHING_WEIGHTS[offset + half];
      weightedSum += neighbor.value * weight;
      totalWeight += weight;
    }
    return { timestamp: point.timestamp, value: weightedSum / totalWeight };
  });
}

// 折れ線をCatmull-Romスプライン相当の3次ベジェに変換して、角のない滑らかな曲線にする。
// 折れ線をCatmull-Romスプライン相当の3次ベジェに変換して、角のない滑らかな曲線にする。
function smoothPath(coords: [number, number][]) {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;

  let path = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const previous = coords[index - 1] ?? coords[index];
    const current = coords[index];
    const next = coords[index + 1];
    const afterNext = coords[index + 2] ?? next;

    const control1X = current[0] + (next[0] - previous[0]) / 6;
    const control1Y = current[1] + (next[1] - previous[1]) / 6;
    const control2X = next[0] - (afterNext[0] - current[0]) / 6;
    const control2Y = next[1] - (afterNext[1] - current[1]) / 6;

    path += ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)}, ${control2X.toFixed(2)} ${control2Y.toFixed(2)}, ${next[0].toFixed(2)} ${next[1].toFixed(2)}`;
  }
  return path;
}

// 単純な折れ線パスを生成する。
function linePath(coords: [number, number][]) {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;

  let path = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
  for (let index = 1; index < coords.length; index += 1) {
    path += ` L ${coords[index][0].toFixed(2)} ${coords[index][1].toFixed(2)}`;
  }
  return path;
}

function chartGeometry(rawPoints: MetricPoint[], smooth = true, timeDomain?: TimeDomain) {
  // 壁時計の窓が指定されている場合、その外側の点は描画対象から外す。
  // 受信が途切れると履歴には窓の外の古い点が残り、そのまま描くと軸からはみ出す。
  const visiblePoints = timeDomain ? pointsWithinDomain(rawPoints, timeDomain) : rawPoints;
  const points = smoothValues(visiblePoints);
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const values = points.map((point) => point.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const range = Math.max(maxValue - minValue, 1);
  const chartMin = Math.max(0, Math.floor(minValue - range * 0.16));
  const chartMax = Math.ceil(maxValue + range * 0.16);
  const chartRange = Math.max(chartMax - chartMin, 1);
  // 時間軸は壁時計の窓を最優先で使う。窓が無い場合(Storybookなど静的表示)だけ、
  // 従来どおりデータの実測範囲へフォールバックする。
  const start = timeDomain ? timeDomain.start : points.length > 0 ? points[0].timestamp : 0;
  const end = timeDomain ? timeDomain.end : points.length > 0 ? points[points.length - 1].timestamp : 1;
  const timeRange = Math.max(end - start, 1);

  const xFor = (timestamp: number) => CHART_PADDING.left + ((timestamp - start) / timeRange) * plotWidth;
  const yFor = (value: number) => CHART_PADDING.top + (1 - (value - chartMin) / chartRange) * plotHeight;
  const path = smooth
    ? smoothPath(points.map((point) => [xFor(point.timestamp), yFor(point.value)]))
    : linePath(points.map((point) => [xFor(point.timestamp), yFor(point.value)]));
  const baselineY = CHART_HEIGHT - CHART_PADDING.bottom;
  // 塗りつぶしは軸の端ではなく、実データがある区間だけを閉じる。
  // 軸の端まで閉じると、データが無い区間まで塗られてしまう。
  const dataStart = points.length > 0 ? points[0].timestamp : start;
  const dataEnd = points.length > 0 ? points[points.length - 1].timestamp : end;
  const areaPath =
    points.length > 0
      ? `${path} L ${xFor(dataEnd).toFixed(2)} ${baselineY} L ${xFor(dataStart).toFixed(2)} ${baselineY} Z`
      : "";
  const gridValues = points.length > 0 ? [chartMax, Math.round((chartMax + chartMin) / 2), chartMin] : [];
  // 時間軸はデータ点の間引きではなく、10秒刻みの切りのよい時刻に目盛りを置く。
  const timeTicks: number[] = [];
  if (points.length > 0) {
    const firstTick = Math.ceil(start / X_TICK_INTERVAL_MS) * X_TICK_INTERVAL_MS;
    for (let tick = firstTick; tick <= end; tick += X_TICK_INTERVAL_MS) {
      timeTicks.push(tick);
    }
  }

  // 最新データから軸の右端までが空いていれば、そこを「データなし」区間として描く。
  // 通常のBLE通知間隔(約1秒)の揺らぎを空白と見せないよう、しきい値を超えた場合だけ扱う。
  const gap =
    timeDomain && points.length > 0 && end - dataEnd > GAP_THRESHOLD_MS
      ? { fromX: xFor(dataEnd), toX: xFor(end), sinceMs: end - dataEnd }
      : null;

  return { areaPath, baselineY, gap, gridValues, hasPoints: points.length > 0, path, timeTicks, xFor, yFor };
}

export function HrChartPanel({
  title = "HR",
  unit = "bpm",
  current,
  points,
  stats,
  color = "#dc3e42",
  smooth = true,
  timeDomain,
}: HrChartPanelProps) {
  const gradientId = useId();
  const [expanded, setExpanded] = useState(true);
  const { areaPath, baselineY, gap, gridValues, hasPoints, path, timeTicks, xFor, yFor } = chartGeometry(
    points,
    smooth,
    timeDomain,
  );

  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-background p-4">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={`h-auto w-full justify-between rounded-lg px-1.5 hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-foreground active:bg-transparent active:translate-y-0 ${expanded ? "pb-3" : ""}`}
      >
        <span className="flex items-center gap-1.5 text-xl font-semibold text-foreground">
          <ChevronDown
            className={`size-5 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          {title}
        </span>
        <span className="text-lg font-bold" style={{ color }}>
          {current != null ? Math.round(current) : "--"}{" "}
          <span className="text-sm font-normal text-secondary-foreground">{unit}</span>
        </span>
      </Button>
      {expanded && (
      <svg
        className="block h-auto w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`${title}のリアルタイムグラフ`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {hasPoints ? (
          <>
            {gridValues.map((value) => (
              <text
                key={value}
                className="fill-muted-foreground text-[6px]"
                x={CHART_PADDING.left - 6}
                y={yFor(value) + 3}
                textAnchor="end"
              >
                {value}
              </text>
            ))}
            {timeTicks.map((tick) => (
              <text
                key={tick}
                className="fill-muted-foreground text-[6px]"
                x={xFor(tick)}
                y={baselineY + 14}
                textAnchor="middle"
              >
                {formatTime(tick)}
              </text>
            ))}
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              className={smooth ? "fill-none stroke-[0.5] [stroke-linecap:round] [stroke-linejoin:round]" : "fill-none stroke-[0.7]"}
              d={path}
              stroke={color}
            />
            {/* データが来ていない区間。線が途切れているだけだと「止まっている」ように見えるため、
                帯とラベルで受信できていないことを明示する。 */}
            {gap && (
              <>
                <rect
                  className="fill-muted-foreground/10"
                  x={gap.fromX}
                  y={CHART_PADDING.top}
                  width={Math.max(gap.toX - gap.fromX, 0)}
                  height={baselineY - CHART_PADDING.top}
                />
                {/* 帯が狭いとラベルがはみ出して読めないため、十分な幅があるときだけ出す。 */}
                {gap.toX - gap.fromX > 60 && (
                  <text
                    className="fill-muted-foreground text-[7px]"
                    x={(gap.fromX + gap.toX) / 2}
                    y={CHART_PADDING.top + 12}
                    textAnchor="middle"
                  >
                    データ待機中 ({Math.round(gap.sinceMs / 1000)}秒)
                  </text>
                )}
              </>
            )}
          </>
        ) : (
          <text
            className="fill-muted-foreground text-[13px] font-medium"
            x={CHART_WIDTH / 2}
            y={CHART_HEIGHT / 2}
            textAnchor="middle"
          >
            データ待機中
          </text>
        )}
      </svg>
      )}
      {expanded && (
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-3 px-8">
          {STAT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-sm text-secondary-foreground">{label}</span>
              <span className="text-base font-medium text-foreground">{stats[key] ?? "--"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
