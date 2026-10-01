import { Switch } from "@fluentui/react-components";

export type OscEnableToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

// OSC送信のON/OFF。状態の表示は Fluent Switch に統一する。
export function OscEnableToggle({ checked, onCheckedChange }: OscEnableToggleProps) {
  return (
    <Switch
      checked={checked}
      onChange={(_, data) => onCheckedChange(data.checked)}
      label="送信を有効化"
      className="shrink-0 whitespace-nowrap"
    />
  );
}
