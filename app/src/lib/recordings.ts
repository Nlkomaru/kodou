import type { RecordingFile } from "@/lib/heart-rate-types";

// 一覧の日付見出し。Rustが返す "YYYY-MM-DD" をそのまま解釈して曜日つきで表示する。
export function formatRecordingDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// 時刻の表示。「22:00」のような24時間表記に固定する(ロケールによる午前/午後表記を避ける)。
export function formatRecordingTime(modifiedMs: number): string {
  return new Date(modifiedMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

// 記録した時間帯。各行のタイムスタンプはUTCなので、表示はここでローカル時刻に直す。
export function formatRecordingRange(startedAtMs: number, endedAtMs: number): string {
  return `${formatRecordingTime(startedAtMs)} - ${formatRecordingTime(endedAtMs)}`;
}

// 平均BPMは小数で届くので、他の値と揃えて整数で見せる。
export function formatBpm(bpm: number): string {
  return String(Math.round(bpm));
}

// ファイルサイズを人が読める単位にする。Parquetは圧縮されるためKB〜MB程度に収まる。
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  // 1桁台のときだけ小数を残し、それ以上は整数に丸めて桁を揃える。
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unitIndex]}`;
}

// 日付ごとのまとまり。Rust側で新しい順に並んでいるので、出現順を保ったままグループ化する。
export type RecordingGroup = {
  date: string;
  recordings: RecordingFile[];
};

export function groupRecordingsByDate(recordings: RecordingFile[]): RecordingGroup[] {
  const groups: RecordingGroup[] = [];
  for (const recording of recordings) {
    const lastGroup = groups.at(-1);
    if (lastGroup?.date === recording.date) {
      lastGroup.recordings.push(recording);
    } else {
      groups.push({ date: recording.date, recordings: [recording] });
    }
  }
  return groups;
}
