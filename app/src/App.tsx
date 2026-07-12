import { useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { HistoryPage } from "@/pages/history/history-page";
import { OscPage } from "@/pages/osc/osc-page";
import { SettingsPage } from "@/pages/settings/settings-page";
import { useAutoConnect } from "@/hooks/use-auto-connect";
import { useHeartRateEvents } from "@/hooks/use-heart-rate-events";
import { useOscSender } from "@/hooks/use-osc-sender";

function App() {
  useHeartRateEvents();
  useOscSender();
  useAutoConnect();

  const [page, setPage] = useState("dashboard");

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar activeItem={page} onNavigate={setPage} />
      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        {page === "dashboard" && <DashboardPage />}
        {page === "history" && <HistoryPage />}
        {page === "osc" && <OscPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
