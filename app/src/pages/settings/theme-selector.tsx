import { Radio, RadioGroup } from "@fluentui/react-components";
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

  // 見出しは Section 側が持つため、Field のラベルは出さず RadioGroup に名前だけ渡す。
  return (
    <RadioGroup
      aria-label="テーマ"
      value={preference}
      onChange={(_event, data) => {
        if (isThemePreference(data.value)) setPreference(data.value);
      }}
    >
      {THEME_OPTIONS.map((option) => (
        <Radio key={option.value} value={option.value} label={option.label} />
      ))}
    </RadioGroup>
  );
}
