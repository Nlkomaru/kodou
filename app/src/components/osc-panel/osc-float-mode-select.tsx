import { Radio } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OscSettings } from "@/lib/osc";
import { SectionHeading } from "./section-heading";

export type OscFloatModeSelectProps = {
  value: OscSettings["hrFloatMode"];
  onChange: (value: OscSettings["hrFloatMode"]) => void;
};

// HRFloat を -1.0〜1.0 と 0.0〜1.0 のどちらで送るかの選択。
// アバター側のパラメータ定義に合わせて切り替える。
export function OscFloatModeSelect({ value, onChange }: OscFloatModeSelectProps) {
  return (
    <section className="grid gap-2">
      <SectionHeading icon={Radio} label="HRFloat モード" />
      <Select
        value={value}
        onValueChange={(next) => {
          // Select は string を返すため、想定外の値は無視して型を守る。
          if (next === "signed" || next === "unsigned") onChange(next);
        }}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="signed">signed (-1.0〜1.0)</SelectItem>
          <SelectItem value="unsigned">unsigned (0.0〜1.0)</SelectItem>
        </SelectContent>
      </Select>
    </section>
  );
}
