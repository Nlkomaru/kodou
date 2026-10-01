import { Field, Radio, RadioGroup } from "@fluentui/react-components";
import { useAtom } from "jotai";
import { isThemePreference, type ThemePreference } from "@/lib/theme";
import { themePreferenceAtom } from "@/state/theme";

// 表示名はこの設定UIのために日本語で統一する。
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "システム" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

export function ThemeSelector() {
  const [preference, setPreference] = useAtom(themePreferenceAtom);

  return (
    <Field label="テーマ" hint="システムを選ぶとOSの設定に追従します。">
      <RadioGroup
        value={preference}
        onChange={(_event, data) => {
          if (isThemePreference(data.value)) setPreference(data.value);
        }}
      >
        {THEME_OPTIONS.map((option) => (
          <Radio key={option.value} value={option.value} label={option.label} />
        ))}
      </RadioGroup>
    </Field>
  );
}
