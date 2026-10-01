import { createElement, useCallback, useId, useRef } from "react";
import { Toast, ToastTitle, useToastController, type ToastIntent } from "@fluentui/react-components";

export const STATUS_TOASTER_ID = "kodou-status";

/** 同じ種類の通知は積み上げず、表示中の内容を更新する。 */
export function useNotification() {
  const { dispatchToast, updateToast } = useToastController(STATUS_TOASTER_ID);
  const instanceId = useId();
  const sequence = useRef(0);
  const activeIds = useRef(new Map<string, string>());

  return useCallback((message: string, category: string, intent: ToastIntent = "info") => {
    const content = createElement(Toast, null, createElement(ToastTitle, null, message));
    const currentId = activeIds.current.get(category);
    if (currentId) {
      updateToast({ toastId: currentId, content, intent });
      return;
    }
    // 消去アニメーション中の古い通知と衝突しない ID を割り当てる。
    const toastId = `${instanceId}-${sequence.current++}`;
    activeIds.current.set(category, toastId);
    dispatchToast(content, {
      toastId,
      intent,
      onStatusChange: (_event, data) => {
        // 自動消去後は同じ種類でも新しい通知として表示できるようにする。
        if (data.status === "dismissed" && activeIds.current.get(category) === toastId) {
          activeIds.current.delete(category);
        }
      },
    });
  }, [dispatchToast, updateToast, instanceId]);
}
