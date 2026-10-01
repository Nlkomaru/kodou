import { Activity, Heart } from "lucide-react";
import { Divider, makeStyles } from "@fluentui/react-components";

// Fluent の Divider は flex-grow: 1 を持つため、横並びの中に置くと横方向へ伸びてしまう。
// 固定幅の区切り線として使えるよう、伸長を止めて高さを与える。
// (Fluent のスタイルは CSS レイヤーの外に注入されるので、Tailwind の utilities では上書きできない)
const useStyles = makeStyles({
  verticalDivider: {
    flexGrow: 0,
    alignSelf: "center",
    height: "64px",
  },
});

export interface DataHeaderProps {
  bpm: number | null;
  rrMs: number | null;
}

export function DataHeader({ bpm, rrMs }: DataHeaderProps) {
  const styles = useStyles();

  return (
    <div className="flex items-end justify-center gap-4">
      <div className="flex items-end gap-2">
        <Heart className="size-6 text-[color:var(--chart-hr,#CE2C31)] mb-[1.5px]" aria-hidden="true" />
        {/* ヒーロー数値は Fluent の Display（68px/76px）に合わせ、単位は Caption1 で添える。 */}
        <div className="flex items-end gap-1.5">
          <span className="text-[68px] leading-[76px] font-semibold text-foreground tabular-nums">
            {bpm ?? "--"}
          </span>
          <span className="text-xs leading-4 text-muted-foreground mb-2">BPM</span>
        </div>
      </div>
      <Divider vertical className={styles.verticalDivider} aria-hidden="true" />
      <div className="flex items-end gap-2">
        <Activity className="size-5 text-[color:var(--chart-rr,#0090FF)] mb-[3px]" aria-hidden="true" />
        {/* 副数値は Title1（28px/36px）に合わせ、ヒーローとの階層を一段下げる。 */}
        <div className="flex items-end gap-1.5">
          <span className="text-[28px] leading-9 font-semibold text-foreground tabular-nums">
            {rrMs ?? "--"}
          </span>
          <span className="text-xs leading-4 font-medium text-muted-foreground mb-1">ms</span>
        </div>
      </div>
    </div>
  );
}
