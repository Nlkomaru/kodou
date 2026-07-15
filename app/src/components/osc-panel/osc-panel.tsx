import { useAtom, useAtomValue } from "jotai";
import { Info, type LucideIcon, Radio, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { OSC_PARAM_META } from "@/lib/osc";
import { activeOscParamsAtom, oscAddressesAtom, oscEnabledAtom, oscTargetsAtom } from "@/state/osc";

// パラメータキーから表示用ラベルを引く。
const LABEL_BY_KEY = new Map(OSC_PARAM_META.map((meta) => [meta.key, meta.label]));

// OSC設定UI。設定内容は config.conf が持ち、ここでは送信のON/OFFだけを切り替える。
// 送信先と送信されるパラメータは、設定ミスに気づけるよう読み取り専用で表示する。
export function OscPanel() {
  const [enabled, setEnabled] = useAtom(oscEnabledAtom);
  const targets = useAtomValue(oscTargetsAtom);
  const addresses = useAtomValue(oscAddressesAtom);
  const activeParams = useAtomValue(activeOscParamsAtom);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">OSC送信</CardTitle>
            <CardDescription className="mt-1">VRChatのAvatar Parameter OSCへ心拍データを送ります</CardDescription>
          </div>
          {/* 送信ON/OFFはこのパネル唯一の操作。状態がひと目で分かるよう、
              有効時はプライマリ色のピルで強調する。 */}
          <Label
            className={
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors " +
              (enabled
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground")
            }
          >
            <Switch checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
            送信を有効化
          </Label>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 送信先 */}
        <section className="grid gap-2">
          <SectionHeading icon={Send} label="送信先" />
          {targets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {targets.map((target) => (
                <Badge key={target} variant="secondary" className="font-mono text-xs">
                  {target}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">送信先が設定されていません</p>
          )}
        </section>

        <Separator />

        {/* 送信パラメータ */}
        <section className="grid gap-2.5">
          <SectionHeading icon={Radio} label="送信パラメータ" count={activeParams.length} />
          {activeParams.length > 0 ? (
            // 角丸が大きいぶん、詰まって見えないよう内側の余白とボックス間隔を広めに取る。
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activeParams.map((key) => (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 rounded-lg bg-muted/30 px-3.5 py-3 ring-1 ring-border/70"
                >
                  <span className="text-xs font-bold">{LABEL_BY_KEY.get(key) ?? key}</span>
                  {(addresses[key] ?? []).map((address) => (
                    <code
                      key={address}
                      className="break-all text-[11px] leading-relaxed text-muted-foreground"
                    >
                      {address}
                    </code>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">送信するパラメータが設定されていません</p>
          )}
        </section>

        {/* 補足: 設定の変更方法。ヒントであることが伝わるよう控えめなボックスにする。 */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/20 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-border/60">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            送信先・送信パラメータ・数値設定は <code>config.conf</code> で変更します。
            編集したらアプリを再起動してください。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// 各セクションの見出し。アイコン＋ラベルで統一し、必要なら件数バッジを添える。
function SectionHeading({ icon: Icon, label, count }: { icon: LucideIcon; label: string; count?: number }) {
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
