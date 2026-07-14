import { useAtom, useAtomValue } from "jotai";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
          <Label className="text-sm font-bold">
            <Switch checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
            送信を有効化
          </Label>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-1">
          <Label className="text-xs font-bold text-muted-foreground">送信先</Label>
          {targets.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {targets.map((target) => (
                <Badge key={target} variant="secondary" className="font-mono text-xs">
                  {target}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">送信先が設定されていません</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label className="text-xs font-bold text-muted-foreground">
            送信パラメータ ({activeParams.length}件)
          </Label>
          {activeParams.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeParams.map((key) => (
                <div key={key} className="flex flex-col gap-1 rounded-lg bg-muted/20 p-2 ring-1 ring-border">
                  <span className="text-xs font-bold">{LABEL_BY_KEY.get(key) ?? key}</span>
                  {(addresses[key] ?? []).map((address) => (
                    <code key={address} className="break-all text-[11px] text-muted-foreground">
                      {address}
                    </code>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">送信するパラメータが設定されていません</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          送信先・送信パラメータ・数値設定は <code>config.conf</code> で変更します。
          編集したらアプリを再起動してください。
        </p>
      </CardContent>
    </Card>
  );
}
