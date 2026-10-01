import assert from "node:assert/strict";
import test from "node:test";
import { appendHistory, HISTORY_LIMIT, rrIntervalsToPoints } from "./heart-rate.ts";

// 複数のRR値を含む通知は、前回の通知より過去の時刻までさかのぼることがある。
test("orders overlapping RR packets chronologically without losing readings", () => {
  const previous = rrIntervalsToPoints(10_000, [800]);
  const incoming = rrIntervalsToPoints(10_100, [780, 820, 800]);

  assert.deepEqual(appendHistory(previous, incoming), [
    { timestamp: 8_480, value: 780 },
    { timestamp: 9_300, value: 820 },
    { timestamp: 10_000, value: 800 },
    { timestamp: 10_100, value: 800 },
  ]);
});

// 上限を超えた場合も受信順ではなく時刻順で古い点を落とし、新しい履歴を維持する。
test("retains the newest timestamps when older samples arrive at capacity", () => {
  const current = Array.from({ length: HISTORY_LIMIT }, (_, index) => ({
    timestamp: 10_000 + index * 100,
    value: 800 + index,
  }));

  assert.deepEqual(appendHistory(current, [{ timestamp: 9_900, value: 900 }]), current);
});

// 遅れて届いた点を含めても、保持期間の境界は最新時刻を基準に判定する。
test("keeps the time-window boundary and excludes expired historical samples", () => {
  assert.deepEqual(
    appendHistory(
      [{ timestamp: 60_000, value: 800 }],
      [{ timestamp: -1, value: 700 }, { timestamp: 0, value: 750 }],
    ),
    [{ timestamp: 0, value: 750 }, { timestamp: 60_000, value: 800 }],
  );
});
