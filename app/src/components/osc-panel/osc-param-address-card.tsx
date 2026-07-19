import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { OscParamMeta } from "@/lib/osc";

export type OscParamAddressCardProps = {
  meta: OscParamMeta;
  /** このパラメータに割り当てられた送信先アドレス。空なら送信されない。 */
  addresses: string[];
  onAdd: (address: string) => void;
  onRemove: (address: string) => void;
};

// 1つのOSCパラメータについて、送信先アドレスの一覧と追加フォームを表示する。
// 入力中の文字列はカード内のローカル状態に閉じ込め、親の再描画を減らす。
export function OscParamAddressCard({ meta, addresses, onAdd, onRemove }: OscParamAddressCardProps) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const trimmed = draft.trim();
    // 空入力と重複は黙って無視する。ここでエラー表示するほどの操作ではない。
    if (!trimmed || addresses.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 px-5 py-4 ring-1 ring-border/70">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold">{meta.label}</span>
        {addresses.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">{addresses.length}件</Badge>
        )}
      </div>
      {addresses.length > 0 ? (
        <div className="flex flex-col gap-1">
          {addresses.map((address) => (
            <div key={address} className="flex items-center gap-1">
              <code className="min-w-0 break-all text-[11px] leading-relaxed text-muted-foreground">
                {address}
              </code>
              <button
                type="button"
                onClick={() => onRemove(address)}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`${address} を削除`}
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">アドレス未設定</p>
      )}
      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="/avatar/parameters/..."
          className="h-7 text-[11px]"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
          aria-label={`${meta.label} にアドレスを追加`}
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}
