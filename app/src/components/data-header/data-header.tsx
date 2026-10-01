import { Activity, Heart } from "lucide-react";
import { Divider, makeStyles } from "@fluentui/react-components";

// Fluent の Divider は flex-grow: 1 を持つため、横並びの中に置くと横方向へ伸びてしまう。
// 固定幅の区切り線として使えるよう、伸長を止めて高さを与える。
// (Fluent のスタイルは CSS レイヤーの外に注入されるので、Tailwind の utilities では上書きできない)
const useStyles = makeStyles({
  verticalDivider: {
    flexGrow: 0,
    alignSelf: "center",
    height: "32px",
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
      <div className="flex items-end gap-3">
        <Heart className="size-6 text-[color:var(--chart-hr,#CE2C31)] mb-[1.5px]" aria-hidden="true" />
        <div className="flex items-end gap-0.5 font-medium">
          <span className="text-4xl leading-8 text-foreground">
            {bpm ?? "--"}
          </span>
          <span className="text-base leading-4 text-muted-foreground">BPM</span>
        </div>
      </div>
      <Divider vertical className={styles.verticalDivider} aria-hidden="true" />
      <div className="flex items-end gap-3">
        <Activity className="size-5.5 text-[color:var(--chart-rr,#0090FF)] mb-[2px]" aria-hidden="true" />
        <div className="flex items-end gap-0.5">
          <span className="text-2xl leading-none font-semibold text-foreground">{rrMs ?? "--"}</span>
          <span className="text-base leading-4 font-medium text-muted-foreground">ms</span>
        </div>
      </div>
    </div>
  );
}
