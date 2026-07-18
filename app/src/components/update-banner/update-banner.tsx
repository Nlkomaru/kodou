import { Download, RefreshCw } from "lucide-react";
import { useAtomValue } from "jotai";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { updateErrorAtom, updateInfoAtom, updateProgressAtom, updateStageAtom } from "@/state/updater";

type UpdateBannerProps = {
  onInstall: () => void;
  onRestart: () => void;
  onDismiss: () => void;
};

// 自動更新の状態をアプリ上部に1行で通知する。
// 更新の適用はユーザーがボタンを押したときだけ行う（勝手に再起動しない）。
export function UpdateBanner({ onInstall, onRestart, onDismiss }: UpdateBannerProps) {
  const stage = useAtomValue(updateStageAtom);
  const info = useAtomValue(updateInfoAtom);
  const error = useAtomValue(updateErrorAtom);
  const progress = useAtomValue(updateProgressAtom);

  // 更新が無いときと、確認に失敗しただけのときは何も出さずアプリの邪魔をしない。
  if (stage === "idle") return null;
  if (stage === "error" && !info) return null;

  return (
    <Alert variant={stage === "error" ? "destructive" : "default"} className="rounded-none border-x-0 border-t-0">
      {stage === "downloading" ? <RefreshCw className="animate-spin" /> : <Download />}
      <AlertTitle className="font-bold">
        {stage === "available" && `新しいバージョン ${info?.version} が利用できます`}
        {stage === "downloading" && "アップデートをダウンロードしています…"}
        {stage === "ready" && "アップデートの準備ができました"}
        {stage === "error" && "アップデートに失敗しました"}
      </AlertTitle>
      <AlertDescription className="text-muted-foreground">
        {stage === "available" && (info?.notes || "リリースノートはありません。")}
        {stage === "downloading" &&
          (progress === null ? "しばらくお待ちください。" : `${Math.round(progress * 100)}% 完了`)}
        {stage === "ready" && "アプリを再起動すると新しいバージョンが適用されます。"}
        {stage === "error" && error}
      </AlertDescription>
      <AlertAction className="flex gap-2">
        {stage === "available" && (
          <>
            <Button size="sm" onClick={onInstall}>
              今すぐ更新
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              あとで
            </Button>
          </>
        )}
        {stage === "ready" && (
          <Button size="sm" onClick={onRestart}>
            再起動して適用
          </Button>
        )}
        {stage === "error" && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            閉じる
          </Button>
        )}
      </AlertAction>
    </Alert>
  );
}
