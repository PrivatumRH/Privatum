/**
 * Guardrail Budget & Rolling-Window Forecast - Privatum v0.1.23
 *
 * Spending guardrails use a 24-hour ROLLING window, not a daily reset. That
 * distinction matters to anyone who hits their cap: capacity does not come
 * back at midnight, it comes back piecemeal as each individual spend ages past
 * the 24-hour mark.
 *
 * Until now the limit was only ever mentioned once a transfer already
 * triggered a warning, and nothing said when headroom would return. This
 * computes both from the same records `evaluateSpend` uses, so the two can
 * never disagree.
 */

import {
  ROLLING_WINDOW_MS,
  type SpendingGuardrailConfig,
  type SpendingRecord,
} from "./spendGuardrails";

export interface GuardrailUsage {
  enabled: boolean;
  usedUsd: number;
  limitUsd: number;
  /** Never negative, even when the window total has overshot the cap. */
  remainingUsd: number;
  /** 0..1, clamped, for rendering a bar. */
  fraction: number;
  /** True once spending has reached or passed the cap. */
  exhausted: boolean;
  recordsInWindow: number;
}

export interface CapacityRelease {
  /** When this spend ages out of the rolling window. */
  at: number;
  /** Headroom returned at that moment. */
  amountUsd: number;
  /** Milliseconds from now until it happens. */
  inMs: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Records still inside the rolling window, oldest first. */
export function recordsInWindow(
  records: SpendingRecord[],
  now = Date.now()
): SpendingRecord[] {
  const cutoff = now - ROLLING_WINDOW_MS;
  return records
    .filter((r) => r.timestamp >= cutoff && r.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function computeUsage(
  config: SpendingGuardrailConfig,
  records: SpendingRecord[],
  now = Date.now()
): GuardrailUsage {
  const inWindow = recordsInWindow(records, now);
  const usedUsd = round2(inWindow.reduce((sum, r) => sum + (r.amountUsd || 0), 0));
  const limitUsd = config.dailyLimitUsd;

  // A zero or negative cap has no meaningful fraction; treat the bar as full
  // rather than dividing by zero and rendering NaN.
  const fraction = limitUsd > 0 ? Math.min(1, Math.max(0, usedUsd / limitUsd)) : 1;

  return {
    enabled: config.enabled,
    usedUsd,
    limitUsd,
    remainingUsd: round2(Math.max(0, limitUsd - usedUsd)),
    fraction,
    exhausted: limitUsd > 0 ? usedUsd >= limitUsd : true,
    recordsInWindow: inWindow.length,
  };
}

/**
 * The next moment headroom returns, and how much.
 *
 * Null when nothing is in the window - there is no pending release because
 * nothing is currently consuming the budget.
 */
export function nextCapacityRelease(
  records: SpendingRecord[],
  now = Date.now()
): CapacityRelease | null {
  const inWindow = recordsInWindow(records, now);
  if (inWindow.length === 0) return null;

  const oldest = inWindow[0];
  const at = oldest.timestamp + ROLLING_WINDOW_MS;

  // Spends sharing an expiry instant release together, so they are reported as
  // one event rather than several identical ones a user would have to add up.
  const amountUsd = round2(
    inWindow
      .filter((r) => r.timestamp + ROLLING_WINDOW_MS === at)
      .reduce((sum, r) => sum + (r.amountUsd || 0), 0)
  );

  return { at, amountUsd, inMs: Math.max(0, at - now) };
}

/** Every upcoming release, soonest first. */
export function capacityTimeline(
  records: SpendingRecord[],
  now = Date.now(),
  limit = 5
): CapacityRelease[] {
  const grouped = new Map<number, number>();
  for (const r of recordsInWindow(records, now)) {
    const at = r.timestamp + ROLLING_WINDOW_MS;
    grouped.set(at, (grouped.get(at) || 0) + (r.amountUsd || 0));
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .slice(0, limit)
    .map(([at, amountUsd]) => ({
      at,
      amountUsd: round2(amountUsd),
      inMs: Math.max(0, at - now),
    }));
}

/**
 * How much headroom will exist at a given future moment, assuming no further
 * spending. Lets the UI answer "can I send this later?" rather than only
 * "can I send this now?".
 */
export function projectedRemainingAt(
  config: SpendingGuardrailConfig,
  records: SpendingRecord[],
  future: number
): number {
  const stillCounted = records.filter(
    (r) => r.timestamp >= future - ROLLING_WINDOW_MS && r.timestamp <= future
  );
  const used = stillCounted.reduce((sum, r) => sum + (r.amountUsd || 0), 0);
  return round2(Math.max(0, config.dailyLimitUsd - used));
}

/** Compact countdown: "4h 12m", "38m", "under a minute". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "under a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export type BudgetTone = "clear" | "moderate" | "high" | "exhausted";

/** Tone for the bar. Thresholds are deliberate, not decorative. */
export function budgetTone(usage: GuardrailUsage): BudgetTone {
  if (usage.exhausted) return "exhausted";
  if (usage.fraction >= 0.8) return "high";
  if (usage.fraction >= 0.5) return "moderate";
  return "clear";
}
