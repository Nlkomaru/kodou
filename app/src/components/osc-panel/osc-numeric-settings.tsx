import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OscSettings } from "@/lib/osc";
import { SectionHeading } from "./section-heading";

export type OscNumericSettingsProps = {
  settings: OscSettings;
  /** 入力文字列のまま渡す。数値化と保存は呼び出し側の責務。 */
  onChange: (key: keyof OscSettings, raw: string) => void;
};

// 表示順とラベルを1か所にまとめ、項目追加時にJSXを増やさずに済むようにする。
const NUMERIC_FIELDS: { key: keyof OscSettings; label: string; min?: number }[] = [
  { key: "bpmMin", label: "BPM 最小値" },
  { key: "bpmMax", label: "BPM 最大値" },
  { key: "averageWindowMs", label: "平均窓 (ms)" },
  { key: "beatPulseMs", label: "拍パルス幅 (ms)" },
  { key: "rrTwitchThresholdMs", label: "RR Twitch しきい値 (ms)" },
  { key: "disconnectTimeoutSecs", label: "自動停止 (秒)", min: 0 },
];

// OSC送信の数値パラメータ群。値の保持は行わず、変更を親へ通知するだけにする。
export function OscNumericSettings({ settings, onChange }: OscNumericSettingsProps) {
  return (
    <section className="grid gap-2">
      <SectionHeading icon={Info} label="数値設定" />
      <div className="grid gap-2 sm:grid-cols-2">
        {NUMERIC_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">{field.label}</Label>
            <Input
              type="number"
              min={field.min}
              value={settings[field.key] as number}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      {/* 0 が「無効」を意味することは値だけでは伝わらないため、補足を添える。 */}
      <p className="text-xs text-muted-foreground">
        自動停止: BLE切断からこの秒数だけ再接続できないとモニタリングを停止します。0 で無効（無限に再接続）。
      </p>
    </section>
  );
}
