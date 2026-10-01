import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { Badge, Button, Input, Text } from "@fluentui/react-components";
import { Section } from "@/components/section/section";

export type OscTargetListProps = {
  /** 現在の送信先一覧（"IP:ポート" 形式）。 */
  targets: string[];
  /** バリデーションを通過した送信先だけが渡る。 */
  onAdd: (target: string) => void;
  onRemove: (target: string) => void;
};

// 入力値が "IP:ポート" 形式かどうかだけを見る素朴な検証。
// 到達性まではここでは判定できないため、書式の取り違えを弾くことに絞る。
function validateTarget(input: string, existing: string[]): string {
  const parts = input.split(":");
  if (parts.length !== 2 || parts[1] === "" || isNaN(Number(parts[1]))) {
    return "IP:ポート形式で入力してください（例: 127.0.0.1:9000）";
  }
  if (existing.includes(input)) return "この送信先は既に追加されています";
  return "";
}

// OSCの送信先一覧と追加フォーム。入力状態と検証はこの中で完結させる。
export function OscTargetList({ targets, onAdd, onRemove }: OscTargetListProps) {
  const [newTarget, setNewTarget] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const trimmed = newTarget.trim();
    if (!trimmed) return;
    const message = validateTarget(trimmed, targets);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    onAdd(trimmed);
    setNewTarget("");
  };

  return (
    <Section icon={Send} label="送信先" count={targets.length}>
      {targets.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {targets.map((target) => (
            <div key={target} className="flex items-center gap-1.5">
              <Badge appearance="tint" color="subtle" shape="rounded" size="medium">
                <Text font="monospace">{target}</Text>
              </Badge>
              <Button
                appearance="subtle"
                size="small"
                icon={<X className="size-3" aria-hidden="true" />}
                aria-label={`${target} を削除`}
                onClick={() => onRemove(target)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">送信先が設定されていません</p>
      )}
      <div className="flex gap-1.5">
        <Input
          aria-label="送信先を追加"
          value={newTarget}
          onChange={(_, data) => {
            setNewTarget(data.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="127.0.0.1:9000"
          size="small"
          className="min-w-0 grow"
        />
        <Button
          appearance="primary"
          size="small"
          icon={<Plus className="size-3" aria-hidden="true" />}
          onClick={handleAdd}
        >
          追加
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </Section>
  );
}
