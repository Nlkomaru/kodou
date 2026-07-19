import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SectionHeadingProps = {
  icon: LucideIcon;
  label: string;
  /** 件数バッジ。undefined なら表示しない。 */
  count?: number;
};

// OSC設定の各セクションの見出し。アイコン＋ラベルで統一し、必要なら件数バッジを添える。
export function SectionHeading({ icon: Icon, label, count }: SectionHeadingProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      {count !== undefined && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
          {count}件
        </Badge>
      )}
    </div>
  );
}
