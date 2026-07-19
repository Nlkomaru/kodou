import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { toast } from "sonner";
import { connectionStatusVariantAtom, errorAtom, statusAtom } from "@/state/heart-rate";

// 接続状態の更新をトーストで通知する。常設の状態表示はサイドバーが担うため、
// ここでは「変化したこと」だけを一時的に知らせる。
// トーストIDを固定して、状態が変わるたびに積み上がらず同じトーストを差し替える。
const STATUS_TOAST_ID = "heart-rate-status";
const ERROR_TOAST_ID = "heart-rate-error";

/** App直下で1度だけ呼ぶ。ページを跨いでも重複してトーストを出さないため。 */
export function useStatusToast() {
  const status = useAtomValue(statusAtom);
  const variant = useAtomValue(connectionStatusVariantAtom);
  const error = useAtomValue(errorAtom);

  useEffect(() => {
    if (!status.message) return;
    if (variant === "destructive") {
      toast.error(status.message, { id: STATUS_TOAST_ID });
    } else {
      toast(status.message, { id: STATUS_TOAST_ID });
    }
  }, [status, variant]);

  useEffect(() => {
    if (!error) return;
    toast.error(error, { id: ERROR_TOAST_ID });
  }, [error]);
}
