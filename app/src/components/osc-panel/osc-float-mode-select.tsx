import { Radio } from "lucide-react";
import { Dropdown, Option } from "@fluentui/react-components";
import type { OscSettings } from "@/lib/osc";
import { SectionHeading } from "./section-heading";

export type OscFloatModeSelectProps = {
  value: OscSettings["hrFloatMode"];
  onChange: (value: OscSettings["hrFloatMode"]) => void;
};

// HRFloat の送信レンジ。表示テキストは Dropdown の value にそのまま使う。
const FLOAT_MODES: { value: OscSettings["hrFloatMode"]; text: string }[] = [
  { value: "signed", text: "signed (-1.0〜1.0)" },
  { value: "unsigned", text: "unsigned (0.0〜1.0)" },
];

// HRFloat を -1.0〜1.0 と 0.0〜1.0 のどちらで送るかの選択。
// アバター側のパラメータ定義に合わせて切り替える。
// Dropdown は value と selectedOptions の両方を制御し、表示と選択状態がずれないようにする。
export function OscFloatModeSelect({ value, onChange }: OscFloatModeSelectProps) {
  const selected = FLOAT_MODES.find((mode) => mode.value === value);

  return (
    <section className="grid gap-2">
      <SectionHeading icon={Radio} label="HRFloat モード" />
      <Dropdown
        aria-label="HRFloat モード"
        size="small"
        value={selected?.text ?? ""}
        selectedOptions={[value]}
        onOptionSelect={(_, data) => {
          // Dropdown は string を返すため、想定外の値は無視して型を守る。
          if (data.optionValue === "signed" || data.optionValue === "unsigned") onChange(data.optionValue);
        }}
      >
        {FLOAT_MODES.map((mode) => (
          <Option key={mode.value} value={mode.value} text={mode.text}>
            {mode.text}
          </Option>
        ))}
      </Dropdown>
    </section>
  );
}
