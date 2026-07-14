import { useAtomValue } from "jotai";
import { ChartColumn, Circle, FileText } from "lucide-react";
import { isRecordingAtom, recordingPathAtom } from "@/state/heart-rate";

export function HistoryPage() {
  const isRecording = useAtomValue(isRecordingAtom);
  const recordingPath = useAtomValue(recordingPathAtom);

  if (isRecording && recordingPath) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[14px] bg-muted/40 p-8 text-center">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <Circle className="size-3 animate-pulse fill-red-500 text-red-500" aria-hidden="true" />
          記録中
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-4" aria-hidden="true" />
          <code className="break-all">{recordingPath}</code>
        </div>
        <p className="text-xs text-muted-foreground">
          心拍データはParquet形式で保存されています。接続を切るとファイルが確定されます。
        </p>
      </div>
    );
  }

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
