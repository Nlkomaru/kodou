import { Activity, Heart } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface DataHeaderProps {
  bpm: number | null;
  rrMs: number | null;
}

export function DataHeader({ bpm, rrMs }: DataHeaderProps) {
  return (
    <div className="flex items-end justify-center gap-4">
      <div className="flex items-end gap-3">
        <Heart className="size-6 text-[#CE2C31]" aria-hidden="true" />
        <div className="flex items-end gap-0.5 font-medium">
          <span className="text-4xl leading-9 text-foreground">{bpm ?? "--"}</span>
          <span className="text-base leading-4 text-muted-foreground">BPM</span>
        </div>
      </div>
      <Separator orientation="vertical" className="h-8 self-center" aria-hidden="true" />
      <div className="flex items-end gap-3">
        <Activity className="size-6 text-[#0090FF]" aria-hidden="true" />
        <div className="flex items-end gap-0.5">
          <span className="text-2xl leading-6 font-semibold text-foreground">{rrMs ?? "--"}</span>
          <span className="text-base leading-4 font-medium text-muted-foreground">ms</span>
        </div>
      </div>
    </div>
  );
}
