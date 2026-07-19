import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type OscEnableToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

// OSC送信のON/OFF。有効時は枠と背景で強調し、送信中であることを一目で分かるようにする。
export function OscEnableToggle({ checked, onCheckedChange }: OscEnableToggleProps) {
  return (
    <Label
      className={
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors " +
        (checked
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "border-border bg-muted/40 text-muted-foreground")
      }
    >
      <Switch checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      送信を有効化
    </Label>
  );
}
