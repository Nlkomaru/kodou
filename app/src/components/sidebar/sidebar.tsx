import {
  Activity,
  Battery,
  ChartColumn,
  ChevronRight,
  Radio,
  Settings,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import kodouLogo from "@/assets/kodou-logo.png";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarProps {
  /** Connection status label text (日本語). */
  status: string;
  /** Navigation items. Defaults to the four standard views. */
  items?: SidebarNavItem[];
  /** Id of the currently active navigation item. */
  activeItem: string;
  /** Called with the item id when a navigation item is clicked. */
  onNavigate?: (id: string) => void;
  /** Battery level label. */
  battery?: string;
  /** Sensor contact label. */
  sensorContact?: string;
  /** Energy expended label. */
  energy?: string;
}

const DEFAULT_ITEMS: SidebarNavItem[] = [
  { id: "dashboard", label: "ダッシュボード", icon: Activity },
  { id: "history", label: "履歴", icon: ChartColumn },
  { id: "osc", label: "OSC送信", icon: Radio },
  { id: "settings", label: "設定", icon: Settings },
];

export function Sidebar({
  status,
  items = DEFAULT_ITEMS,
  activeItem,
  onNavigate,
  battery = "未取得",
  sensorContact = "不明",
  energy = "未取得",
}: SidebarProps) {
  return (
    <div className="flex h-full w-[280px] flex-col justify-between border-r border-border bg-background px-4 py-6">
      <div className="flex flex-col gap-4">
        {/* Logo: 下のナビゲーションと同じ px-4 の内側余白に揃える。 */}
        <div className="flex items-center gap-4 px-4">
          <img
            src={kodouLogo}
            alt="Kodou"
            className="size-12 rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-2xl font-bold leading-8 text-foreground">Kodou</span>
            <span className="text-xs text-secondary-foreground">Heart rate monitor</span>
          </div>
        </div>

        {/* Status: ナビゲーション項目と横幅・左端を揃えるため、外側の余白は付けない。 */}
        <div>
          {(() => {
            const isConnected = status === "接続済み";
            const isTransitional = status.includes("中");
            const bgClass = isConnected ? "bg-status-connected-bg" : "bg-secondary";
            const dotClass = isConnected
              ? "bg-status-connected-dot opacity-[0.68]"
              : isTransitional
                ? "bg-amber-500 opacity-[0.68] animate-pulse"
                : "bg-muted-foreground opacity-[0.68]";
            const fgClass = isConnected ? "text-status-connected-fg" : "text-secondary-foreground";
            return (
              <div
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-4 py-2 ${bgClass}`}
              >
                <span
                  className={`size-2 rounded-full ${dotClass}`}
                  aria-hidden="true"
                />
                <span className={`text-sm font-medium ${fgClass}`}>
                  {status}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeItem;
            return (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                onClick={() => onNavigate?.(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={
                  "h-auto w-full justify-start gap-3 px-4 py-2.5 text-base font-medium " +
                  (isActive
                    ? "bg-secondary text-foreground"
                    : "text-secondary-foreground hover:bg-secondary/50")
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="size-3" aria-hidden="true" />}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Bottom stats */}
      <div className="flex w-full flex-col gap-2 border-t border-border px-4 pt-[13px]">
        <StatRow icon={Battery} label="バッテリー" value={battery} />
        <StatRow icon={Wifi} label="センサー接触" value={sensorContact} />
        <StatRow icon={Zap} label="消費エネルギー" value={energy} />
      </div>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="size-3 text-secondary-foreground" aria-hidden="true" />
        <span className="text-sm text-secondary-foreground">{label}</span>
      </div>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
