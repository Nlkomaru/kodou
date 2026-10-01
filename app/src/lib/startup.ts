export type StartupSettings = {
  autoConnect: boolean;
  restoreStoppedState: boolean;
};

// 既定は自動接続を有効にし、前回の停止状態を尊重する。
export const DEFAULT_STARTUP_SETTINGS: StartupSettings = {
  autoConnect: true,
  restoreStoppedState: true,
};

const STARTUP_SETTINGS_KEY = "kodou.startup-settings";
const MONITOR_STOPPED_KEY = "kodou.monitor-stopped";

/** 起動時の自動接続設定と前回の停止状態から、接続を開始するかを判定する。 */
export function shouldAutoConnect(settings: StartupSettings, monitorStopped: boolean): boolean {
  return settings.autoConnect && (!settings.restoreStoppedState || !monitorStopped);
}

// 起動設定は項目ごとに真偽値を検証し、欠落・不正な項目だけを既定(true)へ戻す。
// 片方だけ壊れた保存値でも、もう片方のユーザー設定は失わない。
export function loadStartupSettings(): StartupSettings {
  try {
    const raw = localStorage.getItem(STARTUP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_STARTUP_SETTINGS };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_STARTUP_SETTINGS };

    // 保存値は外部入力なので、値を取り出してから項目ごとに typeof で検証する。
    const { autoConnect, restoreStoppedState } = parsed as Partial<
      Record<keyof StartupSettings, unknown>
    >;
    return {
      autoConnect:
        typeof autoConnect === "boolean" ? autoConnect : DEFAULT_STARTUP_SETTINGS.autoConnect,
      restoreStoppedState:
        typeof restoreStoppedState === "boolean"
          ? restoreStoppedState
          : DEFAULT_STARTUP_SETTINGS.restoreStoppedState,
    };
  } catch {
    return { ...DEFAULT_STARTUP_SETTINGS };
  }
}

export function saveStartupSettings(settings: StartupSettings): void {
  try {
    localStorage.setItem(STARTUP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorageが使えない環境では設定を保存できないだけで、起動自体は継続する。
  }
}

// 監視の停止は起動設定とは別の意図として保存する。
// 未保存(=初回起動)は false とみなし、従来どおり自動接続を許容する。
export function loadMonitorStopped(): boolean {
  try {
    return localStorage.getItem(MONITOR_STOPPED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveMonitorStopped(stopped: boolean): void {
  try {
    localStorage.setItem(MONITOR_STOPPED_KEY, String(stopped));
  } catch {
    // 保存できない環境では前回の停止状態を復元できないだけで、監視は継続する。
  }
}
