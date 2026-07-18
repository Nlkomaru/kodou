import { ChartColumn, Circle, FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordingFile } from "@/lib/heart-rate-types";
import {
  formatBpm,
  formatFileSize,
  formatRecordingDate,
  formatRecordingRange,
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
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 p-8 text-center">
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
  const { summary } = recording;

  return (
    <li className="flex items-center gap-3 rounded-xl bg-muted/40 px-6 py-4">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-secondary-foreground">
          {recording.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {/* 記録中のファイルは中身を読めないので、時間帯の代わりに最終更新時刻を出す。 */}
          {summary
            ? formatRecordingRange(summary.startedAtMs, summary.endedAtMs)
            : formatRecordingTime(recording.modifiedMs)}
          {" ・ "}
          {formatFileSize(recording.sizeBytes)}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {summary && (
          <dl className="flex items-end gap-3">
            <BpmStat label="最小" value={summary.minBpm} />
            <BpmStat label="平均" value={summary.meanBpm} />
            <BpmStat label="最大" value={summary.maxBpm} />
          </dl>
        )}
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

// BPMの最小・平均・最大を1つ分表示する。
function BpmStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <dt className="text-[0.625rem] leading-3 text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-secondary-foreground">
        {formatBpm(value)}
      </dd>
    </div>
  );
}
