import assert from "node:assert/strict";
import test from "node:test";
import {
  loadMonitorStopped,
  loadStartupSettings,
  shouldAutoConnect,
} from "./startup.ts";

// テスト中だけ最小限の localStorage を差し込み、終了時に元の状態へ必ず戻す。
// Map は保存内容の事前投入と検証のためだけに使う。
function withLocalStorage(run: (store: Map<string, string>) => void) {
  const store = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
    },
  });
  try {
    run(store);
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "localStorage", previous);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
}

// 自動接続ON/OFF × 停止状態復元ON/OFF × 前回停止有無の全8通りを明示的に固定する。
test("covers every auto-connect policy branch", () => {
  const cases: Array<{
    settings: { autoConnect: boolean; restoreStoppedState: boolean };
    stopped: boolean;
    expected: boolean;
  }> = [
    { settings: { autoConnect: false, restoreStoppedState: false }, stopped: false, expected: false },
    { settings: { autoConnect: false, restoreStoppedState: false }, stopped: true, expected: false },
    { settings: { autoConnect: false, restoreStoppedState: true }, stopped: false, expected: false },
    { settings: { autoConnect: false, restoreStoppedState: true }, stopped: true, expected: false },
    { settings: { autoConnect: true, restoreStoppedState: false }, stopped: false, expected: true },
    { settings: { autoConnect: true, restoreStoppedState: false }, stopped: true, expected: true },
    { settings: { autoConnect: true, restoreStoppedState: true }, stopped: false, expected: true },
    { settings: { autoConnect: true, restoreStoppedState: true }, stopped: true, expected: false },
  ];

  for (const { settings, stopped, expected } of cases) {
    assert.equal(
      shouldAutoConnect(settings, stopped),
      expected,
      `settings=${JSON.stringify(settings)} stopped=${stopped}`,
    );
  }
});

// 保存値が無い初回起動は既定へフォールバックし、前回停止も「停止していない」扱いにする。
test("falls back to defaults when nothing is stored", () => {
  withLocalStorage(() => {
    assert.deepEqual(loadStartupSettings(), { autoConnect: true, restoreStoppedState: true });
    assert.equal(loadMonitorStopped(), false);
  });
});

// 壊れたJSONや非オブジェクトでも例外を投げず、両項目とも既定へ戻す。
test("recovers from malformed stored settings", () => {
  for (const raw of ["{not json", "true", "[]", "null", '"autoConnect"']) {
    withLocalStorage((store) => {
      store.set("kodou.startup-settings", raw);
      assert.deepEqual(
        loadStartupSettings(),
        { autoConnect: true, restoreStoppedState: true },
        `raw=${raw}`,
      );
    });
  }
});

// 項目ごとに検証し、壊れた/欠落した項目だけを既定へ戻して健全な項目は維持する。
test("validates settings fields individually", () => {
  const cases: Array<{
    raw: string;
    expected: { autoConnect: boolean; restoreStoppedState: boolean };
  }> = [
    { raw: '{"autoConnect":false}', expected: { autoConnect: false, restoreStoppedState: true } },
    { raw: '{"restoreStoppedState":false}', expected: { autoConnect: true, restoreStoppedState: false } },
    {
      raw: '{"autoConnect":false,"restoreStoppedState":false}',
      expected: { autoConnect: false, restoreStoppedState: false },
    },
    {
      raw: '{"autoConnect":"no","restoreStoppedState":1}',
      expected: { autoConnect: true, restoreStoppedState: true },
    },
    {
      raw: '{"autoConnect":0,"restoreStoppedState":true}',
      expected: { autoConnect: true, restoreStoppedState: true },
    },
    { raw: "{}", expected: { autoConnect: true, restoreStoppedState: true } },
  ];

  for (const { raw, expected } of cases) {
    withLocalStorage((store) => {
      store.set("kodou.startup-settings", raw);
      assert.deepEqual(loadStartupSettings(), expected, `raw=${raw}`);
    });
  }
});

// 停止状態は起動設定とは別キーで保持されるため、設定が壊れても停止意図は残る。
test("keeps stopped intent independent from startup preferences", () => {
  withLocalStorage((store) => {
    store.set("kodou.monitor-stopped", "true");
    store.set("kodou.startup-settings", "{broken");
    assert.deepEqual(loadStartupSettings(), { autoConnect: true, restoreStoppedState: true });
    assert.equal(loadMonitorStopped(), true);
    assert.equal(shouldAutoConnect(loadStartupSettings(), loadMonitorStopped()), false);
  });
});

