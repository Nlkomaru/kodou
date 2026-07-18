import { useEffect, useState } from "react";

// チャートのX軸を進めるための現在時刻。1秒ごとに更新する。
//
// BLEデータが途切れているあいだは再レンダリングのきっかけが無く、
// 時間軸を壁時計基準にしても画面が更新されない。ここで能動的に時刻を刻むことで、
// データの有無にかかわらずチャートが流れ続ける。
//
// 呼び出し側で1つだけ使い、複数のチャートへ同じ値を配ることでX軸を揃える。
export function useWallClockNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
