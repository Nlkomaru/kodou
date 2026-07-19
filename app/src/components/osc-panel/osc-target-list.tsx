import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "./section-heading";

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
    <section className="grid gap-2">
      <SectionHeading icon={Send} label="送信先" count={targets.length} />
      {targets.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {targets.map((target) => (
            <div key={target} className="flex items-center gap-1.5">
              <Badge variant="secondary" className="font-mono text-xs">
                {target}
              </Badge>
              <button
                type="button"
                onClick={() => onRemove(target)}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`${target} を削除`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">送信先が設定されていません</p>
      )}
      <div className="flex gap-1.5">
        <Input
          value={newTarget}
          onChange={(e) => { setNewTarget(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="127.0.0.1:9000"
          className="h-8 text-xs"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3" />
          追加
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
