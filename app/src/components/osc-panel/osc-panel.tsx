import { useState } from "react";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OSC_PARAM_META, parseOscTargets } from "@/lib/osc";
import {
  beatPulseMsAtom,
  configOscTargetsAtom,
  hrBoundsAtom,
  hrFloatModeAtom,
  ironHeartCompatAtom,
  oscEnabledAtom,
  oscParamsAtom,
  oscTargetsAtom,
  oscAverageWindowMsAtom,
  rrTwitchThresholdMsAtom,
  toggleOscParamAtom,
  vrcoscCompatAtom,
} from "@/state/osc";
import type { OscParamKey } from "@/lib/osc";

// OSC設定UI。有効化するとTauri経由でUDP送信を開始し、
// チェックを入れたKodou標準/互換パラメータをVRChatへ流す。
export function OscPanel() {
  const [enabled, setEnabled] = useAtom(oscEnabledAtom);
  const [targets, setTargets] = useAtom(oscTargetsAtom);
  const configTargets = useAtomValue(configOscTargetsAtom);
  // テキストエリアの表示文字列。atomは解析済みの配列を持つため、入力中の生テキストはここで保持する。
  const [targetsDraft, setTargetsDraft] = useState(() => targets.join("\n"));
  const params = useAtomValue(oscParamsAtom);
  const toggleParam = useSetAtom(toggleOscParamAtom);
  const [bounds, setBounds] = useAtom(hrBoundsAtom);
  const [floatMode, setFloatMode] = useAtom(hrFloatModeAtom);
  const [ironHeart, setIronHeart] = useAtom(ironHeartCompatAtom);
  const [vrcosc, setVrcosc] = useAtom(vrcoscCompatAtom);
  const [beatPulseMs, setBeatPulseMs] = useAtom(beatPulseMsAtom);
  const [rrThreshold, setRrThreshold] = useAtom(rrTwitchThresholdMsAtom);
  const [averageWindowMs, setAverageWindowMs] = useAtom(oscAverageWindowMsAtom);

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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">送信先 (1行1つ, ip:port)</Label>
            <Textarea
              value={targetsDraft}
              onChange={(event) => {
                // 入力途中の空行や末尾の改行を保つため、生の文字列はローカルに持ち、atomには解析結果を渡す。
                setTargetsDraft(event.target.value);
                setTargets(parseOscTargets(event.target.value));
              }}
              disabled={!enabled}
              rows={2}
              placeholder="127.0.0.1:9000"
            />
            {configTargets.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                config.conf の送信先（{configTargets.join(", ")}）にも併せて送信します
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                常用する送信先は config.conf に書くとアプリ再起動後も保持されます
              </p>
            )}
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">平均窓 (ms)</Label>
            <Input
              type="number"
              min={1000}
              step={1000}
              value={averageWindowMs}
              onChange={(event) => setAverageWindowMs(Math.max(1000, Number(event.target.value) || 10_000))}
              disabled={!enabled}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">BPM下限</Label>
            <Input
              type="number"
              value={bounds.min}
              onChange={(event) => setBounds({ ...bounds, min: Number(event.target.value) || 0 })}
              disabled={!enabled}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">BPM上限</Label>
            <Input
              type="number"
              value={bounds.max}
              onChange={(event) => setBounds({ ...bounds, max: Number(event.target.value) || 240 })}
              disabled={!enabled}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">HRFloatの範囲</Label>
            <Select value={floatMode} onValueChange={(value) => setFloatMode(value as "signed" | "unsigned")} disabled={!enabled}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signed">-1.0 〜 1.0</SelectItem>
                <SelectItem value="unsigned">0.0 〜 1.0</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">BeatPulse幅 (ms)</Label>
            <Input
              type="number"
              min={20}
              max={500}
              step={10}
              value={beatPulseMs}
              onChange={(event) => setBeatPulseMs(Math.min(500, Math.max(20, Number(event.target.value) || 120)))}
              disabled={!enabled}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label className="text-xs font-bold text-muted-foreground">RR Twitchしきい値 (ms)</Label>
            <Input
              type="number"
              min={5}
              step={5}
              value={rrThreshold}
              onChange={(event) => setRrThreshold(Math.max(5, Number(event.target.value) || 50))}
              disabled={!enabled}
            />
          </div>
          <div className="flex items-end gap-4">
            <Label className="text-sm font-bold">
              <Switch checked={ironHeart} onCheckedChange={(value) => setIronHeart(value === true)} disabled={!enabled} />
              iron-heart互換
            </Label>
            <Label className="text-sm font-bold">
              <Switch checked={vrcosc} onCheckedChange={(value) => setVrcosc(value === true)} disabled={!enabled} />
              VRCOSC互換
            </Label>
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="text-xs font-bold text-muted-foreground">送信パラメータ</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {OSC_PARAM_META.map((meta) => (
              <Label
                key={meta.key}
                className="items-start rounded-lg bg-muted/20 p-2 ring-1 ring-border"
              >
                <Checkbox
                  checked={params[meta.key as OscParamKey]}
                  onCheckedChange={() => toggleParam(meta.key as OscParamKey)}
                  disabled={!enabled}
                />
                <span className="flex flex-col text-xs">
                  <span className="font-bold">{meta.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{meta.address}</span>
                  <span className="text-[10px] text-muted-foreground">{paramTypeLabel(meta.type)}・{meta.note}</span>
                </span>
              </Label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function paramTypeLabel(type: "Bool" | "Int" | "Float") {
  return type === "Bool" ? "bool" : type === "Int" ? "int" : "float";
}