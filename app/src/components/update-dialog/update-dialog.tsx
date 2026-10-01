import { Download, RefreshCw, X } from "lucide-react";
import { useAtomValue } from "jotai";
import {
  Button, Dialog, DialogSurface, DialogBody, DialogTitle,
  DialogContent, DialogActions,
} from "@fluentui/react-components";
import { updateErrorAtom, updateInfoAtom, updateProgressAtom, updateStageAtom } from "@/state/updater";

type UpdateDialogProps = {
  onInstall: () => void;
  onRestart: () => void;
  onDismiss: () => void;
};

// 自動更新の状態をモーダルで通知する。
// 更新の適用はユーザーがボタンを押したときだけ行う（勝手に再起動しない）。
export function UpdateDialog({ onInstall, onRestart, onDismiss }: UpdateDialogProps) {
  const stage = useAtomValue(updateStageAtom);
  const info = useAtomValue(updateInfoAtom);
  const error = useAtomValue(updateErrorAtom);
  const progress = useAtomValue(updateProgressAtom);

  // 更新が無いときと、確認に失敗しただけのときは何も出さずアプリの邪魔をしない。
  const open = stage !== "idle" && !(stage === "error" && !info);

  // ダウンロード中は中断できないため、閉じる手段（×・Esc・外側クリック）を塞ぐ。
  const isDownloading = stage === "downloading";

  return (
    <Dialog open={open} modalType={isDownloading ? "alert" : "modal"}
      onOpenChange={(_event, data) => { if (!data.open && !isDownloading) onDismiss(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle action={!isDownloading ? (
            <Button appearance="subtle" icon={<X size={16} />} aria-label="閉じる" onClick={onDismiss} />
          ) : null}>
            {isDownloading ? <RefreshCw className="mr-2 inline-block size-4 animate-spin" /> : <Download className="mr-2 inline-block size-4" />}
            {stage === "available" && `新しいバージョン ${info?.version} が利用できます`}
            {stage === "downloading" && "アップデートをダウンロードしています…"}
            {stage === "ready" && "アップデートの準備ができました"}
            {stage === "error" && "アップデートに失敗しました"}
          </DialogTitle>
          <DialogContent className="whitespace-pre-wrap">
            {stage === "available" && (info?.notes || "リリースノートはありません。")}
            {stage === "downloading" &&
              (progress === null ? "しばらくお待ちください。" : `${Math.round(progress * 100)}% 完了`)}
            {stage === "ready" && "アプリを再起動すると新しいバージョンが適用されます。"}
            {stage === "error" && error}
          </DialogContent>
        <DialogActions>
          {stage === "available" && (
            <>
              <Button appearance="subtle" onClick={onDismiss}>
                あとで
              </Button>
              <Button appearance="primary" onClick={onInstall}>今すぐ更新</Button>
            </>
          )}
          {stage === "ready" && <Button appearance="primary" onClick={onRestart}>再起動して適用</Button>}
          {stage === "error" && (
            <Button appearance="subtle" onClick={onDismiss}>
              閉じる
            </Button>
          )}
        </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
