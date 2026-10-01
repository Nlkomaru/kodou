import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Card, makeStyles, mergeClasses } from "@fluentui/react-components";
import { formatTime } from "@/lib/heart-rate";
import type { MetricPoint, TimeDomain } from "@/lib/heart-rate-types";

const CHART_WIDTH = 720;
const CHART_HEIGHT = 120;
// 左はY軸ラベル、右は時刻ラベルがSVGの外へはみ出さないためのガター。
// 左右を同じ幅にすることで、ヘッダー・統計の左右余白とも揃えられる。
const PLOT_GUTTER_X = 30;
const CHART_PADDING = { top: 10, right: PLOT_GUTTER_X, bottom: 22, left: PLOT_GUTTER_X };
const PLOT_WIDTH = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
const PLOT_BASELINE_Y = CHART_HEIGHT - CHART_PADDING.bottom;
const X_TICK_INTERVAL_MS = 10_000;
// 端の時刻ラベルがSVGからはみ出さないかを判定するための概算文字幅(6pxフォントの数字とコロン)。
const LABEL_CHAR_WIDTH = 3.6;
// プロットの左右ガターを割合で表し、ヘッダーと統計の余白をどの表示幅でもプロットの端に合わせる。
const GUTTER_PERCENT = `${((PLOT_GUTTER_X / CHART_WIDTH) * 100).toFixed(4)}%`;
// 境界をまたぐ曲線区間は窓外2点を参照し、その各値の平滑化にさらに2点必要になる。
// この4点を残すことで、時間窓が次のサンプルへ進んでも境界付近の値と傾きを保つ。
const BOUNDARY_NEIGHBOR_RADIUS = 4;

// 見出し行は幅いっぱいのクリック領域にしたいが、Fluent Button は中央寄せ・最小幅・既定パディングを持つ。
// Fluent のスタイルは CSS レイヤーの外に注入されるため Tailwind の utilities では打ち消せず、makeStyles を使う。
const useStyles = makeStyles({
  headerButton: {
    width: "100%",
    height: "auto",
    minWidth: 0,
    justifyContent: "space-between",
    // グラフのプロット左端と同じ位置にタイトルと現在値を揃える。
    padding: `0 ${GUTTER_PERCENT}`,
  },
  // 展開時だけ下に余白を作り、グラフとの間隔を確保する。
  headerButtonExpanded: {
    paddingBottom: "12px",
  },
  // 統計もプロットと同じガターに合わせる。
  statsGrid: {
    paddingLeft: GUTTER_PERCENT,
    paddingRight: GUTTER_PERCENT,
  },
});

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
   * 受信できていない区間は塗りも文字も置かない空白になる。
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

// 時間窓の内側の点に、平滑化・スプラインの端点計算に必要な前後の隣接サンプルだけを加えて返す。
// 窓外の点を含むパスも、表示はクリップ矩形の内側だけに限定する。
function selectWindowPoints(points: MetricPoint[], neighborRadius: number, timeDomain?: TimeDomain): MetricPoint[] {
  if (!timeDomain || points.length === 0) return points;

  let firstInside = -1;
  let lastInside = -1;
  for (let index = 0; index < points.length; index += 1) {
    const { timestamp } = points[index];
    if (timestamp < timeDomain.start || timestamp > timeDomain.end) continue;
    if (firstInside === -1) firstInside = index;
    lastInside = index;
  }

  // 最後のデータも左へ流れ去ったら、描画用の隣接点は不要になる。
  if (firstInside === -1) return [];

  const from = Math.max(0, firstInside - neighborRadius);
  const to = Math.min(points.length - 1, lastInside + neighborRadius);
  return to < from ? [] : points.slice(from, to + 1);
}

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

// 10秒刻みの切りのよい時刻に目盛りを置く。データの有無にかかわらず壁時計の窓から算出する。
function buildTimeTicks(start: number, end: number): number[] {
  const firstTick = Math.ceil(start / X_TICK_INTERVAL_MS) * X_TICK_INTERVAL_MS;
  const ticks: number[] = [];
  for (let tick = firstTick; tick <= end; tick += X_TICK_INTERVAL_MS) {
    ticks.push(tick);
  }
  return ticks;
}

function chartGeometry(rawPoints: MetricPoint[], smooth = true, timeDomain?: TimeDomain) {
  // 描画に使う点は窓の内外にまたがる。窓の中の点だけを平滑化・補間すると端が途切れて跳ねるため、
  // 隣接サンプルを残しておき、見せる範囲はクリップ矩形で切る。パスは隣接分しか伸びない。
  const windowPoints = selectWindowPoints(rawPoints, smooth ? BOUNDARY_NEIGHBOR_RADIUS : 1, timeDomain);
  // smooth=false は生の値で描く。平滑化は曲線補間の有無とは独立した見た目のオプション。
  const points = smooth ? smoothValues(windowPoints) : windowPoints;
  // 目盛りや値域は窓の中で実際に見える点だけから決め、端の隣接サンプルに引きずられないようにする。
  const visiblePoints = timeDomain
    ? points.filter((point) => point.timestamp >= timeDomain.start && point.timestamp <= timeDomain.end)
    : points;
  const hasPoints = visiblePoints.length > 0;

  const values = visiblePoints.map((point) => point.value);
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

  const xFor = (timestamp: number) => CHART_PADDING.left + ((timestamp - start) / timeRange) * PLOT_WIDTH;
  const yFor = (value: number) => CHART_PADDING.top + (1 - (value - chartMin) / chartRange) * PLOT_HEIGHT;
  const coords = points.map((point) => [xFor(point.timestamp), yFor(point.value)] as [number, number]);
  const path = hasPoints ? (smooth ? smoothPath(coords) : linePath(coords)) : "";
  // 塗りつぶしは実データのある区間の両端で閉じる。端が窓の外ならクリップされ、
  // 窓の内側で途切れているならそこで閉じるため、データの無い側は塗られない。
  const dataStart = points.length > 0 ? points[0].timestamp : start;
  const dataEnd = points.length > 0 ? points[points.length - 1].timestamp : end;
  const areaPath = hasPoints
    ? `${path} L ${xFor(dataEnd).toFixed(2)} ${PLOT_BASELINE_Y} L ${xFor(dataStart).toFixed(2)} ${PLOT_BASELINE_Y} Z`
    : "";
  const gridValues = hasPoints ? [chartMax, Math.round((chartMax + chartMin) / 2), chartMin] : [];
  // 時刻目盛りはデータが無くても壁時計の窓から作るため、待機中も軸は流れ続ける。
  const timeTicks = timeDomain || hasPoints ? buildTimeTicks(start, end) : [];

  return { areaPath, gridValues, hasPoints, path, timeTicks, xFor, yFor };
}

export function HrChartPanel({
  title = "HR",
  unit = "bpm",
  current,
  points,
  stats,
  // テーマのチャート色トークン。未定義の環境(Storybookなど)では従来色にフォールバックする。
  color = "var(--chart-hr, #dc3e42)",
  smooth = true,
  timeDomain,
}: HrChartPanelProps) {
  const gradientId = useId();
  const clipId = useId();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  const { areaPath, gridValues, hasPoints, path, timeTicks, xFor, yFor } = chartGeometry(points, smooth, timeDomain);

  return (
    <Card appearance="filled" size="large" className="min-w-0">
      <Button
        appearance="transparent"
        className={mergeClasses(styles.headerButton, expanded && styles.headerButtonExpanded)}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
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
              {/* stroke/stop-color の属性は var() を解決しないため CSS プロパティとして渡す。 */}
              <stop offset="0%" style={{ stopColor: color }} stopOpacity="0.2" />
              <stop offset="100%" style={{ stopColor: color }} stopOpacity="0" />
            </linearGradient>
            {/* 描画は常にこの固定の矩形で切るため、窓が進んでも線の切れ端が跳ねない。 */}
            <clipPath id={clipId}>
              <rect
                x={CHART_PADDING.left}
                y={CHART_PADDING.top}
                width={PLOT_WIDTH}
                height={PLOT_HEIGHT}
              />
            </clipPath>
          </defs>
          {hasPoints && (
            <>
              {gridValues.map((value, index) => (
                <text
                  key={`${value}-${index}`}
                  className="fill-muted-foreground text-[6px]"
                  x={CHART_PADDING.left - 6}
                  y={yFor(value) + 3}
                  textAnchor="end"
                >
                  {value}
                </text>
              ))}
              <g clipPath={`url(#${clipId})`}>
                <path d={areaPath} fill={`url(#${gradientId})`} />
                <path
                  className={
                    smooth
                      ? "fill-none stroke-[0.5] [stroke-linecap:round] [stroke-linejoin:round]"
                      : "fill-none stroke-[0.7]"
                  }
                  d={path}
                  style={{ stroke: color }}
                />
              </g>
            </>
          )}
          {timeTicks.map((tick) => {
            const centerX = xFor(tick);
            const label = formatTime(tick);
            // 中央寄せのラベルがSVGの左右端からはみ出す目盛りは描かない。
            // 右側にもガターを確保してあるため、通常はすべて収まる。
            const halfWidth = (label.length * LABEL_CHAR_WIDTH) / 2;
            if (centerX - halfWidth < 0 || centerX + halfWidth > CHART_WIDTH) return null;
            return (
              <text
                key={tick}
                className="fill-muted-foreground text-[6px]"
                x={centerX}
                y={PLOT_BASELINE_Y + 14}
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
      )}
      {expanded && (
        <div className={mergeClasses("grid grid-cols-3 gap-x-4 gap-y-2 pt-3", styles.statsGrid)}>
          {STAT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm text-secondary-foreground">{label}</span>
              <span className="text-base font-medium text-foreground">{stats[key] ?? "--"}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
