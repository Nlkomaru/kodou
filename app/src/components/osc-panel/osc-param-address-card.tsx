import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge, Button, Card, Input } from "@fluentui/react-components";
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
    <Card appearance="filled-alternative" size="small" className="min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold">{meta.label}</span>
        {addresses.length > 0 && (
          <Badge appearance="tint" color="subtle" shape="rounded" size="small">
            {addresses.length}件
          </Badge>
        )}
      </div>
      {addresses.length > 0 ? (
        <div className="flex flex-col gap-1">
          {addresses.map((address) => (
            <div key={address} className="flex items-center gap-1">
              <code className="min-w-0 grow break-all text-[11px] leading-relaxed text-muted-foreground">
                {address}
              </code>
              <Button
                appearance="subtle"
                size="small"
                icon={<X className="size-2.5" aria-hidden="true" />}
                aria-label={`${address} を削除`}
                onClick={() => onRemove(address)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">アドレス未設定</p>
      )}
      <div className="flex gap-1">
        <Input
          aria-label={`${meta.label} のアドレス`}
          value={draft}
          onChange={(_, data) => setDraft(data.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="/avatar/parameters/..."
          size="small"
          className="min-w-0 grow"
        />
        <Button
          appearance="primary"
          size="small"
          icon={<Plus className="size-3" aria-hidden="true" />}
          aria-label={`${meta.label} にアドレスを追加`}
          onClick={handleAdd}
        />
      </div>
    </Card>
  );
}
