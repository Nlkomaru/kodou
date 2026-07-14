import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useAtomValue } from "jotai";
import { RecordingList } from "@/components/recording-list/recording-list";
import { isTauriRuntime } from "@/lib/heart-rate";
import type { RecordingFile } from "@/lib/heart-rate-types";
import { recordingPathAtom } from "@/state/heart-rate";

export function HistoryPage() {
  const recordingPath = useAtomValue(recordingPathAtom);
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [error, setError] = useState("");

  // 記録の開始・停止でファイルが増えるため、recordingPathの変化も再取得のきっかけにする。
  useEffect(() => {
    if (!isTauriRuntime()) return;

    invoke<RecordingFile[]>("list_recordings")
      .then(setRecordings)
      .catch((listError) => setError(String(listError)));
  }, [recordingPath]);

  // OSのファイルエクスプローラーで、該当ファイルを選択した状態でフォルダを開く。
  const handleReveal = useCallback((path: string) => {
    revealItemInDir(path).catch((revealError) => setError(String(revealError)));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <RecordingList
        recordings={recordings}
        activePath={recordingPath}
        onReveal={handleReveal}
      />
    </div>
  );
}
