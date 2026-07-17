import { useAtomValue } from "jotai";
import { Sidebar } from "./sidebar";
import { connectionStatusLabelAtom, readingAtom } from "@/state/heart-rate";

type AppSidebarProps = {
  activeItem: string;
  onNavigate: (id: string) => void;
};

// プレゼンテーショナルなSidebarへ、心拍atomの状態を流し込むコンテナ。
export function AppSidebar({ activeItem, onNavigate }: AppSidebarProps) {
  const statusLabel = useAtomValue(connectionStatusLabelAtom);
  const reading = useAtomValue(readingAtom);

  return (
    <Sidebar
      status={statusLabel}
      activeItem={activeItem}
      onNavigate={onNavigate}
      battery={reading?.batteryPercent == null ? "未取得" : `${reading.batteryPercent}%`}
      sensorContact={
        reading?.sensorContactDetected == null
          ? "不明"
          : reading.sensorContactDetected
            ? "検出"
            : "未検出"
      }
      energy={reading?.energyExpended == null ? "未取得" : `${reading.energyExpended} J`}
    />
  );
}
