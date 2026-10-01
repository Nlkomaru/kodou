import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@fluentui/react-components";

export type SectionProps = {
  /** 見出しのアイコン。省略するとアイコン無しの見出しになる。 */
  icon?: LucideIcon;
  /** 見出しのテキスト。 */
  label: string;
  /** 見出しの下に添える補足説明。 */
  description?: string;
  /** 見出しの右に添える件数バッジ。undefined なら表示しない。 */
  count?: number;
  /** 見出し行の右端に置く操作（スイッチなど）。 */
  action?: ReactNode;
  /** 1: ページ全体の見出し / 2: ページ内のまとまり（既定）。 */
  level?: 1 | 2;
  children: ReactNode;
};

// 見出しの文字サイズは Fluent のタイプスケールに合わせる。
// 1 は Subtitle1（20px/28px）、2 は Subtitle2（16px/22px）。
const HEADING_CLASS: Record<1 | 2, string> = {
  1: "text-xl font-semibold leading-7",
  2: "text-base font-semibold leading-[22px]",
};

/**
 * 設定画面のまとまり。
 * Fluent の設定画面に合わせ、内容を枠で囲わず「見出し + 余白」で区切る。
 * まとまり同士を分ける場合は呼び出し側で Divider を挟む。
 */
export function Section({
  icon: Icon,
  label,
  description,
  count,
  action,
  level = 2,
  children,
}: SectionProps) {
  // ページ見出しは h1、ページ内のまとまりは h2 にして、見出し階層を実際の構造と一致させる。
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <Heading className={HEADING_CLASS[level]}>{label}</Heading>
            {count !== undefined && (
              <Badge appearance="tint" color="subtle" shape="rounded" size="small">
                {count}件
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs leading-4 text-secondary-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
