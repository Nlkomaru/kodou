import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge, Button, Input } from "@fluentui/react-components";
import type { OscParamMeta } from "@/lib/osc";

export type OscParamAddressRowProps = {
  meta: OscParamMeta;
  /** このパラメータに割り当てられた送信先アドレス。空なら送信されない。 */
  addresses: string[];
  onAdd: (address: string) => void;
  onRemove: (address: string) => void;
};

// 1つのOSCパラメータの行。ラベルとアドレス一覧・追加フォームを横に並べる。
// 入力中の文字列は行の中のローカル状態に閉じ込め、親の再描画を減らす。
export function OscParamAddressRow({ meta, addresses, onAdd, onRemove }: OscParamAddressRowProps) {
  const [draft, setDraft] = useState("");

  const handleAdd = () => {
    const trimmed = draft.trim();
    // 空入力と重複は黙って無視する。ここでエラー表示するほどの操作ではない。
    if (!trimmed || addresses.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-44">
        <span className="text-sm font-semibold">{meta.label}</span>
        {addresses.length > 0 && (
          <Badge appearance="tint" color="subtle" shape="rounded" size="small">
            {addresses.length}件
          </Badge>
        )}
      </div>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        {addresses.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {addresses.map((address) => (
              <div key={address} className="flex items-center gap-1.5">
                {/* アドレスは記号だけの文字列なので等幅で読み比べやすくする。 */}
                <code className="min-w-0 grow break-all font-mono text-xs leading-5 text-secondary-foreground">
                  {address}
                </code>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<X className="size-3" aria-hidden="true" />}
                  aria-label={`${address} を削除`}
                  onClick={() => onRemove(address)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">アドレス未設定（送信しません）</p>
        )}
        <div className="flex gap-1.5">
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
      </div>
    </div>
  );
}
