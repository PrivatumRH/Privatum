/**
 * Guardrail Capacity Forecasting & Budget Runway Engine for PRIVATUM.
 *
 * Provides client-side forward-looking spending trajectory modeling,
 * forecasting when daily/single guardrail limits will be depleted based
 * on queued offline outbox transactions, trailing velocity, and rolling
 * 24-hour reset drop-offs.
 *
 * 100% client-side deterministic evaluation with zero external telemetry.
 */

import {
  DEFAULT_GUARDRAIL_CONFIG,
  type SpendingGuardrailConfig,
  type SpendingRecord,
  get24hSpendTotal,
  estimateUsdValue,
  ROLLING_WINDOW_MS,
} from "./spendGuardrails";
import type { OfflineTransaction } from "./offlineOutbox";

export interface BudgetRunwayContext {
  guardrailConfig?: SpendingGuardrailConfig;
  spendingHistory?: SpendingRecord[];
  offlineOutbox?: OfflineTransaction[];
  now?: number;
}

export interface RollingResetWindow {
  oldestRecordTimestamp?: number;
  timeUntilResetMs: number;
  formattedTimeUntilReset: string;
  amountExpiringUsd: number;
}

export type RunwayRiskTier = "sustainable" | "elevated" | "critical" | "exhausted";

export interface BudgetRunwayReport {
  enabled: boolean;
  dailyLimitUsd: number;
  singleTxLimitUsd: number;
  strictMode: boolean;
  current24hSpentUsd: number;
  remainingHeadroomUsd: number;
  headroomPercent: number;
  burnRate24hUsd: number;
  burnRate7dUsd: number;
  projectedRunwayDays: number | null;
  formattedRunway: string;
  queuedOutboxTotalUsd: number;
  queuedOutboxCount: number;
  willQueuedExceedLimit: boolean;
  projectedRemainingAfterOutboxUsd: number;
  riskTier: RunwayRiskTier;
  resetWindow: RollingResetWindow;
  recommendations: string[];
  summary: string;
}

/**
 * Formats duration in milliseconds to human-readable hours and minutes.
 */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Generates forward-looking budget runway and guardrail capacity report.
 */
export function generateBudgetRunwayReport(
  context: BudgetRunwayContext = {}
): BudgetRunwayReport {
  const config = context.guardrailConfig || DEFAULT_GUARDRAIL_CONFIG;
  const history = context.spendingHistory || [];
  const outbox = context.offlineOutbox || [];
  const now = context.now || Date.now();

  const enabled = config.enabled;
  const dailyLimitUsd = config.dailyLimitUsd;
  const singleTxLimitUsd = config.singleTxLimitUsd;
  const strictMode = config.strictMode;

  const current24hSpentUsd = get24hSpendTotal(history, now);
  const remainingHeadroomUsd = enabled
    ? Math.max(0, Math.round((dailyLimitUsd - current24hSpentUsd) * 100) / 100)
    : 999999;

  const headroomPercent =
    enabled && dailyLimitUsd > 0
      ? Math.round((remainingHeadroomUsd / dailyLimitUsd) * 100)
      : 100;

  // 1. Trailing Burn Rate (7-day velocity)
  const sevenDaysCutoff = now - 7 * ROLLING_WINDOW_MS;
  const sevenDayRecords = history.filter((r) => r.timestamp >= sevenDaysCutoff);
  const sevenDayTotalUsd = sevenDayRecords.reduce(
    (acc, r) => acc + (r.amountUsd || 0),
    0
  );
  const burnRate7dUsd = Math.round((sevenDayTotalUsd / 7) * 100) / 100;
  const burnRate24hUsd = current24hSpentUsd;

  // 2. Queued Outbox Commitment
  const queuedItems = outbox.filter((tx) => tx.status === "queued");
  const queuedOutboxCount = queuedItems.length;
  let queuedOutboxTotalUsd = 0;
  for (const tx of queuedItems) {
    queuedOutboxTotalUsd += estimateUsdValue(tx.amount, tx.asset);
  }
  queuedOutboxTotalUsd = Math.round(queuedOutboxTotalUsd * 100) / 100;

  const willQueuedExceedLimit = enabled && queuedOutboxTotalUsd > remainingHeadroomUsd;
  const projectedRemainingAfterOutboxUsd = Math.round(
    (remainingHeadroomUsd - queuedOutboxTotalUsd) * 100
  ) / 100;

  // 3. Rolling Window Reset Forecast
  const cutoff24h = now - ROLLING_WINDOW_MS;
  const active24hRecords = history
    .filter((r) => r.timestamp >= cutoff24h)
    .sort((a, b) => a.timestamp - b.timestamp);

  let resetWindow: RollingResetWindow = {
    timeUntilResetMs: 0,
    formattedTimeUntilReset: "No active spend",
    amountExpiringUsd: 0,
  };

  if (active24hRecords.length > 0) {
    const oldest = active24hRecords[0];
    const expiryTimestamp = oldest.timestamp + ROLLING_WINDOW_MS;
    const timeUntilResetMs = Math.max(0, expiryTimestamp - now);
    resetWindow = {
      oldestRecordTimestamp: oldest.timestamp,
      timeUntilResetMs,
      formattedTimeUntilReset: formatDurationMs(timeUntilResetMs),
      amountExpiringUsd: oldest.amountUsd || 0,
    };
  }

  // 4. Projected Runway Duration
  let projectedRunwayDays: number | null = null;
  let formattedRunway = "Ample runway (> 7 days)";

  if (!enabled) {
    formattedRunway = "Unlimited (Guardrails Disabled)";
  } else if (remainingHeadroomUsd <= 0) {
    projectedRunwayDays = 0;
    formattedRunway = "Depleted (0 days)";
  } else {
    const effectiveDailyBurn = Math.max(burnRate7dUsd, burnRate24hUsd * 0.5);
    if (effectiveDailyBurn > 0) {
      projectedRunwayDays =
        Math.round((remainingHeadroomUsd / effectiveDailyBurn) * 10) / 10;
      if (projectedRunwayDays < 1.0) {
        const hours = Math.round(projectedRunwayDays * 24);
        formattedRunway = `${hours} hours remaining`;
      } else if (projectedRunwayDays <= 7.0) {
        formattedRunway = `${projectedRunwayDays} days remaining`;
      } else {
        formattedRunway = "Ample runway (> 7 days)";
      }
    } else {
      formattedRunway = "Ample runway (Zero recent burn)";
    }
  }

  // 5. Risk Tier Determination
  let riskTier: RunwayRiskTier = "sustainable";
  if (!enabled) {
    riskTier = "sustainable";
  } else if (remainingHeadroomUsd <= 0) {
    riskTier = "exhausted";
  } else if (willQueuedExceedLimit || (projectedRunwayDays !== null && projectedRunwayDays < 0.5)) {
    riskTier = "critical";
  } else if (
    headroomPercent < 30 ||
    queuedOutboxTotalUsd > 0.5 * remainingHeadroomUsd ||
    (projectedRunwayDays !== null && projectedRunwayDays < 2.0)
  ) {
    riskTier = "elevated";
  } else {
    riskTier = "sustainable";
  }

  // 6. Actionable Recommendations
  const recommendations: string[] = [];

  if (!enabled) {
    recommendations.push(
      "Spending guardrails are currently disabled. Enable guardrails to enforce daily caps and budget runway alerts."
    );
  } else {
    if (willQueuedExceedLimit) {
      const excessUsd = Math.round((queuedOutboxTotalUsd - remainingHeadroomUsd) * 100) / 100;
      recommendations.push(
        `Queued outbox transfers ($${queuedOutboxTotalUsd.toFixed(2)}) exceed remaining daily limit by $${excessUsd.toFixed(2)}. Broadcasting will be blocked under current limits.`
      );
    } else if (queuedOutboxCount > 0) {
      recommendations.push(
        `${queuedOutboxCount} queued transfer(s) totaling $${queuedOutboxTotalUsd.toFixed(2)} fit safely within remaining headroom ($${remainingHeadroomUsd.toFixed(2)} available).`
      );
    }

    if (riskTier === "exhausted") {
      recommendations.push(
        `Daily cap reached ($${dailyLimitUsd.toFixed(2)}). Next headroom release of $${resetWindow.amountExpiringUsd.toFixed(2)} occurs in ${resetWindow.formattedTimeUntilReset}.`
      );
    } else if (riskTier === "elevated") {
      recommendations.push(
        `Remaining headroom is at ${headroomPercent}% ($${remainingHeadroomUsd.toFixed(2)}). Consider pacing transfers until next reset in ${resetWindow.formattedTimeUntilReset}.`
      );
    }

    if (resetWindow.amountExpiringUsd > 0 && riskTier !== "exhausted") {
      recommendations.push(
        `Rolling 24h reset will restore $${resetWindow.amountExpiringUsd.toFixed(2)} in capacity in ${resetWindow.formattedTimeUntilReset}.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        `Budget runway is sustainable. $${remainingHeadroomUsd.toFixed(2)} of $${dailyLimitUsd.toFixed(2)} daily limit remaining (${headroomPercent}% headroom).`
      );
    }
  }

  const summary = enabled
    ? `Budget Runway Forecast: $${remainingHeadroomUsd.toFixed(2)} remaining of $${dailyLimitUsd.toFixed(2)} daily limit (${headroomPercent}% capacity, ${formattedRunway}, Risk: ${riskTier.toUpperCase()}).`
    : "Budget Runway Forecast: Guardrails are disabled. No daily spend ceiling enforced.";

  return {
    enabled,
    dailyLimitUsd,
    singleTxLimitUsd,
    strictMode,
    current24hSpentUsd,
    remainingHeadroomUsd,
    headroomPercent,
    burnRate24hUsd,
    burnRate7dUsd,
    projectedRunwayDays,
    formattedRunway,
    queuedOutboxTotalUsd,
    queuedOutboxCount,
    willQueuedExceedLimit,
    projectedRemainingAfterOutboxUsd,
    riskTier,
    resetWindow,
    recommendations,
    summary,
  };
}
