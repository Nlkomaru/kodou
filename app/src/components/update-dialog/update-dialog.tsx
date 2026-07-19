import { Download, RefreshCw } from "lucide-react";
import { useAtomValue } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isDownloading) onDismiss(); }}>
      <DialogContent
        showCloseButton={!isDownloading}
        onEscapeKeyDown={(e) => { if (isDownloading) e.preventDefault(); }}
        onInteractOutside={(e) => { if (isDownloading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDownloading ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
            {stage === "available" && `新しいバージョン ${info?.version} が利用できます`}
            {stage === "downloading" && "アップデートをダウンロードしています…"}
            {stage === "ready" && "アップデートの準備ができました"}
            {stage === "error" && "アップデートに失敗しました"}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {stage === "available" && (info?.notes || "リリースノートはありません。")}
            {stage === "downloading" &&
              (progress === null ? "しばらくお待ちください。" : `${Math.round(progress * 100)}% 完了`)}
            {stage === "ready" && "アプリを再起動すると新しいバージョンが適用されます。"}
            {stage === "error" && error}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {stage === "available" && (
            <>
              <Button variant="ghost" onClick={onDismiss}>
                あとで
              </Button>
              <Button onClick={onInstall}>今すぐ更新</Button>
            </>
          )}
          {stage === "ready" && <Button onClick={onRestart}>再起動して適用</Button>}
          {stage === "error" && (
            <Button variant="ghost" onClick={onDismiss}>
              閉じる
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
