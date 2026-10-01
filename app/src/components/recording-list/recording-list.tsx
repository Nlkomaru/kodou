import { Fragment } from "react";
import { ChartColumn, Circle, FileText, FolderOpen } from "lucide-react";
import { Badge, Button, Card, Divider } from "@fluentui/react-components";
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
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
        <ChartColumn className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-secondary-foreground">まだ記録がありません。</p>
        <p className="text-xs text-muted-foreground">
          心拍センサーへ接続すると、Parquetファイルとして自動で記録されます。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groupRecordingsByDate(recordings).map((group) => (
        <section key={group.date} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-muted-foreground">
            {formatRecordingDate(group.date)}
          </h2>
          {/* 記録は1つの面にまとめ、行の間は区切り線で仕切る。 */}
          <Card appearance="filled" className="min-w-0">
            <ul className="flex flex-col">
              {group.recordings.map((recording, index) => (
                <Fragment key={recording.path}>
                  {index > 0 && <Divider />}
                  <RecordingRow
                    recording={recording}
                    isRecording={recording.path === activePath}
                    onReveal={onReveal}
                  />
                </Fragment>
              ))}
            </ul>
          </Card>
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
    <li className="flex items-center gap-3 py-3">
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
          <Badge
            appearance="tint"
            color="subtle"
            shape="circular"
            size="medium"
            className="gap-1.5"
          >
            <Circle className="size-2 animate-pulse fill-red-500 text-red-500" aria-hidden="true" />
            記録中
          </Badge>
        )}
        <Button
          appearance="outline"
          icon={<FolderOpen className="size-4" aria-hidden="true" />}
          onClick={() => onReveal(recording.path)}
          title={recording.path}
        >
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
