import { ChartColumn, Circle, FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordingFile } from "@/lib/heart-rate-types";
import {
  formatFileSize,
  formatRecordingDate,
  formatRecordingTime,
  groupRecordingsByDate,
} from "@/lib/recordings";

export interface RecordingListProps {
  recordings: RecordingFile[];
  // 記録中のファイルパス。一覧の中で該当行に「記録中」を出すために使う。
  activePath?: string | null;
  // ファイルをOSのエクスプローラーで開く。
  onReveal: (path: string) => void;
}

export function RecordingList({ recordings, activePath, onReveal }: RecordingListProps) {
  if (recordings.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[14px] bg-muted/40 p-8 text-center">
        <ChartColumn className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-secondary-foreground">まだ記録がありません。</p>
        <p className="text-xs text-muted-foreground">
          心拍センサーへ接続すると、Parquetファイルとして自動で記録されます。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupRecordingsByDate(recordings).map((group) => (
        <section key={group.date} className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">
            {formatRecordingDate(group.date)}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {group.recordings.map((recording) => (
              <RecordingRow
                key={recording.path}
                recording={recording}
                isRecording={recording.path === activePath}
                onReveal={onReveal}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface RecordingRowProps {
  recording: RecordingFile;
  isRecording: boolean;
  onReveal: (path: string) => void;
}

function RecordingRow({ recording, isRecording, onReveal }: RecordingRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-[14px] bg-muted/40 px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-secondary-foreground">
          {recording.name}
        </span>
        {/* 記録中はサイズが増え続けるため、確定済みの情報である時刻を先に置く。 */}
        <span className="text-xs text-muted-foreground">
          {formatRecordingTime(recording.modifiedMs)} ・ {formatFileSize(recording.sizeBytes)}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {isRecording && (
          <Badge variant="secondary" className="gap-1.5">
            <Circle className="size-2 animate-pulse fill-red-500 text-red-500" aria-hidden="true" />
            記録中
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReveal(recording.path)}
          title={recording.path}
        >
          <FolderOpen aria-hidden="true" />
          フォルダで開く
        </Button>
      </div>
    </li>
  );
}
