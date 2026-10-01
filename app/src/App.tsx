import { useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { UpdateDialog } from "@/components/update-dialog/update-dialog";
import { Toaster } from "@fluentui/react-components";
import { STATUS_TOASTER_ID } from "@/hooks/use-notification";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { HistoryPage } from "@/pages/history/history-page";
import { OscPage } from "@/pages/osc/osc-page";
import { SettingsPage } from "@/pages/settings/settings-page";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { useAutoConnect } from "@/hooks/use-auto-connect";
import { useHeartRateEvents } from "@/hooks/use-heart-rate-events";
import { useOscSender } from "@/hooks/use-osc-sender";
import { useStatusToast } from "@/hooks/use-status-toast";

function App() {
  useHeartRateEvents();
  useOscSender();
  useAutoConnect();
  // 接続状態の通知はページを跨いで一元化したいため、App直下で1度だけ購読する。
  useStatusToast();
  const { installUpdate, restartApp, dismissUpdate } = useAppUpdater();

  const [page, setPage] = useState("dashboard");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* 更新通知はモーダルで前面に出して見落としを防ぐ。 */}
      <UpdateDialog onInstall={installUpdate} onRestart={restartApp} onDismiss={dismissUpdate} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar activeItem={page} onNavigate={setPage} />
        {/* スクロールバーの有無で描画幅が変わらないよう、常に同じ余白を確保する。 */}
        <main className="min-w-0 flex-1 overflow-y-auto p-6 [scrollbar-gutter:stable]">
          {page === "dashboard" && <DashboardPage />}
          {page === "history" && <HistoryPage />}
          {page === "osc" && <OscPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
      <Toaster toasterId={STATUS_TOASTER_ID} position="bottom-end" />
    </div>
  );
}

export default App;
