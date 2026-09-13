import { describe, it, expect } from "bun:test";
import { ROLLING_WINDOW_MS, type SpendingGuardrailConfig, type SpendingRecord } from "./spendGuardrails";
import {
  budgetTone,
  capacityTimeline,
  computeUsage,
  formatCountdown,
  nextCapacityRelease,
  projectedRemainingAt,
  recordsInWindow,
} from "./guardrailForecast";

const NOW = 1_760_000_000_000;
const HOUR = 60 * 60 * 1000;

const config = (over: Partial<SpendingGuardrailConfig> = {}): SpendingGuardrailConfig => ({
  enabled: true,
  dailyLimitUsd: 500,
  singleTxLimitUsd: 250,
  strictMode: false,
  ...over,
});

const spend = (hoursAgo: number, amountUsd: number): SpendingRecord => ({
  txHash: `0x${hoursAgo}${amountUsd}`,
  timestamp: NOW - hoursAgo * HOUR,
  amount: amountUsd,
  symbol: "USDG",
  amountUsd,
  recipient: "0xrecipient",
});

describe("recordsInWindow", () => {
  it("keeps only spends inside the rolling window, oldest first", () => {
    const records = [spend(1, 10), spend(30, 999), spend(20, 20), spend(23.9, 5)];
    const inWindow = recordsInWindow(records, NOW);
    expect(inWindow.map((r) => r.amountUsd)).toEqual([5, 20, 10]);
  });

  it("excludes a spend that has just aged out", () => {
    const records = [{ ...spend(0, 50), timestamp: NOW - ROLLING_WINDOW_MS - 1 }];
    expect(recordsInWindow(records, NOW)).toHaveLength(0);
  });

  it("includes a spend exactly on the window boundary", () => {
    const records = [{ ...spend(0, 50), timestamp: NOW - ROLLING_WINDOW_MS }];
    expect(recordsInWindow(records, NOW)).toHaveLength(1);
  });

  it("ignores records timestamped in the future", () => {
    expect(recordsInWindow([spend(-3, 40)], NOW)).toHaveLength(0);
  });
});

describe("computeUsage", () => {
  it("sums only in-window spending", () => {
    const usage = computeUsage(config(), [spend(2, 100), spend(40, 400)], NOW);
    expect(usage.usedUsd).toBe(100);
    expect(usage.remainingUsd).toBe(400);
    expect(usage.recordsInWindow).toBe(1);
  });

  it("reports a clamped fraction for the bar", () => {
    expect(computeUsage(config(), [spend(1, 250)], NOW).fraction).toBe(0.5);
    expect(computeUsage(config(), [spend(1, 5000)], NOW).fraction).toBe(1);
    expect(computeUsage(config(), [], NOW).fraction).toBe(0);
  });

  it("never reports negative headroom after an overshoot", () => {
    const usage = computeUsage(config(), [spend(1, 800)], NOW);
    expect(usage.remainingUsd).toBe(0);
    expect(usage.exhausted).toBe(true);
  });

  it("treats reaching the cap exactly as exhausted", () => {
    expect(computeUsage(config(), [spend(1, 500)], NOW).exhausted).toBe(true);
  });

  it("does not divide by zero on a zero limit", () => {
    const usage = computeUsage(config({ dailyLimitUsd: 0 }), [spend(1, 10)], NOW);
    expect(Number.isNaN(usage.fraction)).toBe(false);
    expect(usage.fraction).toBe(1);
    expect(usage.exhausted).toBe(true);
  });

  it("carries the enabled flag through", () => {
    expect(computeUsage(config({ enabled: false }), [], NOW).enabled).toBe(false);
  });
});

describe("nextCapacityRelease", () => {
  it("is null when nothing is consuming the budget", () => {
    expect(nextCapacityRelease([], NOW)).toBeNull();
    expect(nextCapacityRelease([spend(40, 100)], NOW)).toBeNull();
  });

  it("reports the oldest in-window spend aging out", () => {
    const release = nextCapacityRelease([spend(2, 50), spend(20, 120)], NOW);
    expect(release?.amountUsd).toBe(120);
    // The 20-hour-old spend clears the window four hours from now.
    expect(release?.inMs).toBe(4 * HOUR);
  });

  it("groups spends that expire at the same instant into one release", () => {
    const together = [spend(20, 60), spend(20, 40)];
    const release = nextCapacityRelease(together, NOW);
    expect(release?.amountUsd).toBe(100);
  });

  it("never reports a negative countdown", () => {
    const onBoundary = [{ ...spend(0, 30), timestamp: NOW - ROLLING_WINDOW_MS }];
    expect(nextCapacityRelease(onBoundary, NOW)?.inMs).toBe(0);
  });
});

describe("capacityTimeline", () => {
  it("lists upcoming releases soonest first", () => {
    const timeline = capacityTimeline([spend(2, 10), spend(20, 30), spend(10, 20)], NOW);
    expect(timeline.map((r) => r.amountUsd)).toEqual([30, 20, 10]);
  });

  it("merges same-instant releases", () => {
    const timeline = capacityTimeline([spend(6, 25), spend(6, 25), spend(1, 10)], NOW);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].amountUsd).toBe(50);
  });

  it("respects the limit argument", () => {
    const many = [spend(1, 1), spend(2, 1), spend(3, 1), spend(4, 1), spend(5, 1), spend(6, 1)];
    expect(capacityTimeline(many, NOW, 3)).toHaveLength(3);
  });

  it("is empty when nothing is in the window", () => {
    expect(capacityTimeline([spend(48, 100)], NOW)).toEqual([]);
  });
});

describe("projectedRemainingAt", () => {
  it("returns full headroom once every spend has aged out", () => {
    const records = [spend(2, 300)];
    const future = NOW + ROLLING_WINDOW_MS;
    expect(projectedRemainingAt(config(), records, future)).toBe(500);
  });

  it("still counts a spend that has not yet aged out", () => {
    const records = [spend(2, 300)];
    expect(projectedRemainingAt(config(), records, NOW + HOUR)).toBe(200);
  });

  it("answers the practical question: enough headroom later?", () => {
    // 450 spent 20h ago against a 500 cap leaves 50 now, but 500 in four hours.
    const records = [spend(20, 450)];
    expect(projectedRemainingAt(config(), records, NOW)).toBe(50);
    expect(projectedRemainingAt(config(), records, NOW + 4 * HOUR + 1000)).toBe(500);
  });

  it("never goes negative", () => {
    expect(projectedRemainingAt(config(), [spend(1, 9000)], NOW)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("formats hours and minutes", () => {
    expect(formatCountdown(4 * HOUR + 12 * 60000)).toBe("4h 12m");
  });

  it("drops the hour when under one", () => {
    expect(formatCountdown(38 * 60000)).toBe("38m");
  });

  it("drops the minutes when exactly on the hour", () => {
    expect(formatCountdown(3 * HOUR)).toBe("3h");
  });

  it("handles sub-minute and elapsed cases", () => {
    expect(formatCountdown(30_000)).toBe("under a minute");
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(-5000)).toBe("now");
  });
});

describe("budgetTone", () => {
  const toneFor = (spentUsd: number) => budgetTone(computeUsage(config(), [spend(1, spentUsd)], NOW));

  it("grades by real thresholds", () => {
    expect(toneFor(100)).toBe("clear");
    expect(toneFor(249)).toBe("clear");
    expect(toneFor(250)).toBe("moderate");
    expect(toneFor(399)).toBe("moderate");
    expect(toneFor(400)).toBe("high");
    expect(toneFor(499)).toBe("high");
    expect(toneFor(500)).toBe("exhausted");
    expect(toneFor(700)).toBe("exhausted");
  });

  it("is clear with no spending at all", () => {
    expect(budgetTone(computeUsage(config(), [], NOW))).toBe("clear");
  });
});
