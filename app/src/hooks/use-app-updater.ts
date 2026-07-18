import { useCallback, useEffect, useRef } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useSetAtom } from "jotai";
import { isTauriRuntime } from "@/lib/heart-rate";
import { updateErrorAtom, updateInfoAtom, updateProgressAtom, updateStageAtom } from "@/state/updater";

// 起動時に GitHub Releases の latest.json を見て更新の有無を確認する。
// 実際のダウンロード・適用はユーザーが確認してから行うため、ここでは検出までに留める。
export function useAppUpdater() {
  const setStage = useSetAtom(updateStageAtom);
  const setInfo = useSetAtom(updateInfoAtom);
  const setError = useSetAtom(updateErrorAtom);
  const setProgress = useSetAtom(updateProgressAtom);
  // check() が返す Update ハンドルはダウンロード時に再利用する必要があるため保持する。
  const pendingUpdate = useRef<Update | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    // React StrictModeの二重マウントで二回チェックしないようにする。
    if (checked.current) return;
    checked.current = true;

    // ブラウザ(Storybook/vite preview)では updater プラグインが無いので何もしない。
    if (!isTauriRuntime()) return;

    check()
      .then((update) => {
        if (!update) return;
        pendingUpdate.current = update;
        setInfo({ version: update.version, notes: update.body ?? "" });
        setStage("available");
      })
      .catch((checkError) => {
        // ネットワーク断などで更新確認に失敗しても、アプリ本体の利用は妨げない。
        // 表示だけ出して心拍監視はそのまま続行させる。
        setError(String(checkError));
        setStage("error");
      });
  }, [setInfo, setStage, setError]);

  // ユーザーが同意したときだけダウンロードとインストールを実行する。
  const installUpdate = useCallback(async () => {
    const update = pendingUpdate.current;
    if (!update) return;

    setStage("downloading");
    setProgress(null);

    try {
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          downloaded = 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          // 総サイズ不明のときは進捗を出さず、UI側で不定形表示にする。
          setProgress(contentLength > 0 ? downloaded / contentLength : null);
        }
      });
      setStage("ready");
    } catch (installError) {
      setError(String(installError));
      setStage("error");
    }
  }, [setStage, setProgress, setError]);

  // インストール済みバイナリを反映するには再起動が必要。
  const restartApp = useCallback(async () => {
    await relaunch();
  }, []);

  // 「あとで」を選んだ場合は今回の起動では通知しない。
  const dismissUpdate = useCallback(() => {
    setStage("idle");
  }, [setStage]);

  return { installUpdate, restartApp, dismissUpdate };
}
