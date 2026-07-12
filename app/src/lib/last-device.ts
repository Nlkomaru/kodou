import type { HeartRateDevice } from "./heart-rate-types";

const STORAGE_KEY = "kodou.last-device";

// 起動時の自動再接続に必要な最小限(id/name/address)だけ保存する。
// rssiやservicesはスキャンし直さないと意味がないため永続化しない。
export function loadLastDevice(): HeartRateDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HeartRateDevice>;
    if (typeof parsed.id !== "string" || parsed.id === "") return null;

    return {
      id: parsed.id,
      name: typeof parsed.name === "string" ? parsed.name : "前回接続した心拍センサー",
      address: typeof parsed.address === "string" ? parsed.address : "",
      rssi: null,
      services: [],
    };
  } catch {
    return null;
  }
}

export function saveLastDevice(device: HeartRateDevice) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: device.id, name: device.name, address: device.address }),
    );
  } catch {
    // localStorageが使えない環境では自動再接続を諦めるだけで、記録自体は続行する。
  }
}
