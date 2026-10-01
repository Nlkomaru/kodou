import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useAtomValue } from "jotai";
import { RecordingList } from "@/components/recording-list/recording-list";
import { Section } from "@/components/section/section";
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
    <div className="flex max-w-4xl flex-col gap-6">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Section
        level={1}
        label="履歴"
        description="記録した心拍データは、日付ごとにParquetファイルとして保存されます。"
      >
        <RecordingList
          recordings={recordings}
          activePath={recordingPath}
          onReveal={handleReveal}
        />
      </Section>
    </div>
  );
}
