import { ChartColumn } from "lucide-react";

export function HistoryPage() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[14px] bg-muted/40 p-8 text-center">
      <ChartColumn className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-secondary-foreground">
        記録したセッションの表示は準備中です。
      </p>
      <p className="text-xs text-muted-foreground">
        心拍データは接続中、Parquetファイルとしてアプリデータフォルダに保存されています。
      </p>
    </div>
  );
}
