import { useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { UpdateBanner } from "@/components/update-banner/update-banner";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { HistoryPage } from "@/pages/history/history-page";
import { OscPage } from "@/pages/osc/osc-page";
import { SettingsPage } from "@/pages/settings/settings-page";
import { useAppUpdater } from "@/hooks/use-app-updater";
import { useAutoConnect } from "@/hooks/use-auto-connect";
import { useHeartRateEvents } from "@/hooks/use-heart-rate-events";
import { useOscSender } from "@/hooks/use-osc-sender";

function App() {
  useHeartRateEvents();
  useOscSender();
  useAutoConnect();
  const { installUpdate, restartApp, dismissUpdate } = useAppUpdater();

  const [page, setPage] = useState("dashboard");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* 更新通知はサイドバーより上、画面全幅に出して見落としを防ぐ。 */}
      <UpdateBanner onInstall={installUpdate} onRestart={restartApp} onDismiss={dismissUpdate} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar activeItem={page} onNavigate={setPage} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {page === "dashboard" && <DashboardPage />}
          {page === "history" && <HistoryPage />}
          {page === "osc" && <OscPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
