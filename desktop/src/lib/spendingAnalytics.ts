/**
 * Spending Analytics & Counterparty Velocity Engine for PRIVATUM Assistant.
 *
 * Provides conversational spending audits over the local transaction ledger.
 * 100% client-side: all computations run in device memory with zero external queries.
 *
 * Features:
 *   - Top counterparty ranking by cumulative outgoing volume
 *   - Tag-level spending breakdown across the full ledger or a time window
 *   - Rolling N-day spending velocity (amount sent per day)
 *   - Per-counterparty detail: total sent, tx count, assets, time range
 */

import { TAG_CONFIG, TRANSACTION_TAGS } from "./transactionTags";
import type { ParsedSpendingAnalyticsIntent } from "./assistant/types";

export interface AnalyticsTransaction {
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: string;
  timestamp?: number;
  hash?: string;
  tag?: string;
}

export interface SpendingAnalyticsResult {
  handled: true;
  summary: string;
  details?: string[];
  chartData?: { label: string; value: number; color?: string }[];
  intent?: ParsedSpendingAnalyticsIntent;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse an amount string to a float. Returns 0 on failure.
 */
function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Returns the epoch ms cutoff for a given timeframe window ending now.
 */
function timeframeCutoff(timeframe?: "week" | "month"): number {
  if (!timeframe) return 0;
  const MS = timeframe === "week" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return Date.now() - MS;
}

/**
 * Shorten an address to first 6 + last 4 chars for display.
 */
function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Get a display-friendly name for a counterparty.
 * Falls back to a shortened address if it looks like an 0x address.
 */
function formatCounterparty(cp: string): string {
  if (/^0x[a-fA-F0-9]{40}$/.test(cp.trim())) return shortenAddr(cp);
  return cp.trim() || "(unknown)";
}

/**
 * Sum outgoing amounts per asset for a set of transactions.
 */
function sumByAsset(txs: AnalyticsTransaction[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const tx of txs) {
    const a = parseAmount(tx.amount);
    acc[tx.asset] = (acc[tx.asset] || 0) + a;
  }
  return acc;
}

/**
 * Format an asset breakdown map as a human-readable string.
 */
function formatAssetSums(sums: Record<string, number>): string {
  return Object.entries(sums)
    .map(([asset, total]) => `${total.toFixed(4)} ${asset}`)
    .join(" + ");
}

// ---------------------------------------------------------------------------
// Analytics functions
// ---------------------------------------------------------------------------

/**
 * Ranks counterparties by total outgoing volume (send transactions only).
 */
export function getTopCounterparties(
  transactions: AnalyticsTransaction[],
  limit = 5,
  timeframe?: "week" | "month"
): { counterparty: string; total: number; asset: string; txCount: number }[] {
  const cutoff = timeframeCutoff(timeframe);
  const outgoing = transactions.filter(
    (t) =>
      t.type === "send" &&
      (cutoff === 0 || (t.timestamp !== undefined && t.timestamp >= cutoff))
  );

  const byCounterparty: Record<
    string,
    { totals: Record<string, number>; txCount: number }
  > = {};

  for (const tx of outgoing) {
    const key = tx.counterparty.toLowerCase();
    if (!byCounterparty[key]) byCounterparty[key] = { totals: {}, txCount: 0 };
    const a = parseAmount(tx.amount);
    byCounterparty[key].totals[tx.asset] =
      (byCounterparty[key].totals[tx.asset] || 0) + a;
    byCounterparty[key].txCount += 1;
  }

  // Sort by largest single-asset total (primary asset: USDG > ETH > other)
  const ASSET_PRIORITY = ["USDG", "ETH"];
  const ranked = Object.entries(byCounterparty)
    .map(([cp, { totals, txCount }]) => {
      const primaryAsset =
        ASSET_PRIORITY.find((a) => totals[a] !== undefined) ||
        Object.keys(totals)[0] ||
        "USDG";
      return {
        counterparty: cp,
        total: totals[primaryAsset] || 0,
        asset: primaryAsset,
        txCount,
        allTotals: totals,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);

  return ranked.map(({ counterparty, total, asset, txCount }) => ({
    counterparty,
    total,
    asset,
    txCount,
  }));
}

/**
 * Breaks down total outgoing spend by tag across the ledger or a time window.
 */
export function getSpendingByTag(
  transactions: AnalyticsTransaction[],
  timeframe?: "week" | "month"
): { tag: string; total: number; asset: string; txCount: number; color?: string }[] {
  const cutoff = timeframeCutoff(timeframe);
  const outgoing = transactions.filter(
    (t) =>
      t.type === "send" &&
      (cutoff === 0 || (t.timestamp !== undefined && t.timestamp >= cutoff))
  );

  const byTag: Record<
    string,
    { totals: Record<string, number>; txCount: number }
  > = {};

  for (const tx of outgoing) {
    const tag = tx.tag || "Untagged";
    if (!byTag[tag]) byTag[tag] = { totals: {}, txCount: 0 };
    const a = parseAmount(tx.amount);
    byTag[tag].totals[tx.asset] = (byTag[tag].totals[tx.asset] || 0) + a;
    byTag[tag].txCount += 1;
  }

  const ASSET_PRIORITY = ["USDG", "ETH"];

  return Object.entries(byTag)
    .map(([tag, { totals, txCount }]) => {
      const primaryAsset =
        ASSET_PRIORITY.find((a) => totals[a] !== undefined) ||
        Object.keys(totals)[0] ||
        "USDG";
      const config = TAG_CONFIG[tag as (typeof TRANSACTION_TAGS)[number]];
      return {
        tag,
        total: totals[primaryAsset] || 0,
        asset: primaryAsset,
        txCount,
        color: config ? config.dotClass : undefined,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Computes a rolling N-day spending velocity.
 * Returns total sent per day over the rolling window, plus the aggregate.
 */
export function getVelocity(
  transactions: AnalyticsTransaction[],
  days = 7
): {
  periodDays: number;
  totalByAsset: Record<string, number>;
  dailyAvgByAsset: Record<string, number>;
  txCount: number;
  chartData: { label: string; value: number; color?: string }[];
} {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const outgoing = transactions.filter(
    (t) =>
      t.type === "send" &&
      t.timestamp !== undefined &&
      t.timestamp >= cutoff
  );

  const totalByAsset = sumByAsset(outgoing);
  const dailyAvgByAsset: Record<string, number> = {};
  for (const [asset, total] of Object.entries(totalByAsset)) {
    dailyAvgByAsset[asset] = total / days;
  }

  // Build per-day chart data
  const dayMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    dayMap[label] = 0;
  }
  for (const tx of outgoing) {
    const d = new Date(tx.timestamp!);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (label in dayMap) {
      dayMap[label] += parseAmount(tx.amount);
    }
  }

  const chartData = Object.entries(dayMap).map(([label, value]) => ({
    label,
    value: parseFloat(value.toFixed(4)),
  }));

  return {
    periodDays: days,
    totalByAsset,
    dailyAvgByAsset,
    txCount: outgoing.length,
    chartData,
  };
}

/**
 * Returns a detail view for a single named counterparty.
 */
export function getCounterpartyDetail(
  transactions: AnalyticsTransaction[],
  counterpartyQuery: string,
  timeframe?: "week" | "month"
): {
  counterparty: string;
  totalByAsset: Record<string, number>;
  txCount: number;
  firstSeen?: number;
  lastSeen?: number;
  tags: string[];
} | null {
  const cutoff = timeframeCutoff(timeframe);
  const q = counterpartyQuery.toLowerCase().trim();

  const matched = transactions.filter(
    (t) =>
      t.type === "send" &&
      t.counterparty.toLowerCase().includes(q) &&
      (cutoff === 0 || (t.timestamp !== undefined && t.timestamp >= cutoff))
  );

  if (matched.length === 0) return null;

  const totalByAsset = sumByAsset(matched);
  const timestamps = matched.map((t) => t.timestamp).filter((ts): ts is number => ts !== undefined);
  const tags = Array.from(new Set(matched.map((t) => t.tag || "Untagged")));

  return {
    counterparty: matched[0].counterparty,
    totalByAsset,
    txCount: matched.length,
    firstSeen: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
    lastSeen: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Main dispatcher: takes a ParsedSpendingAnalyticsIntent + transactions,
 * runs the appropriate analytics function, and returns a rich result.
 */
export function runSpendingAnalytics(
  intent: ParsedSpendingAnalyticsIntent,
  transactions: AnalyticsTransaction[]
): SpendingAnalyticsResult {
  const { subtype, timeframe, counterparty } = intent;
  const windowLabel = timeframe === "week" ? "this week" : timeframe === "month" ? "this month" : "all time";

  // --- Top Counterparties ---
  if (subtype === "top_counterparties") {
    const results = getTopCounterparties(transactions, 5, timeframe);
    if (results.length === 0) {
      return {
        handled: true,
        summary: `No outgoing transactions found ${timeframe ? windowLabel : "in your ledger"}.`,
        intent,
      };
    }

    const details = results.map(
      (r, i) =>
        `${i + 1}. ${formatCounterparty(r.counterparty)} - ${r.total.toFixed(4)} ${r.asset} (${r.txCount} tx)`
    );

    const chartData = results.map((r) => ({
      label: formatCounterparty(r.counterparty),
      value: r.total,
    }));

    return {
      handled: true,
      summary: `Top ${results.length} counterparty(s) by outgoing volume (${windowLabel}):`,
      details,
      chartData,
      intent: { ...intent, summary: `Top counterparties ${windowLabel}`, chartData },
    };
  }

  // --- Tag Breakdown ---
  if (subtype === "tag_breakdown") {
    const results = getSpendingByTag(transactions, timeframe);
    if (results.length === 0) {
      return {
        handled: true,
        summary: `No outgoing transactions found ${timeframe ? windowLabel : "in your ledger"}.`,
        intent,
      };
    }

    const total = results.reduce((s, r) => s + r.total, 0);
    const details = results.map((r) => {
      const pct = total > 0 ? ((r.total / total) * 100).toFixed(1) : "0.0";
      return `${r.tag}: ${r.total.toFixed(4)} ${r.asset} (${pct}%, ${r.txCount} tx)`;
    });

    const chartData = results.map((r) => ({
      label: r.tag,
      value: r.total,
      color: r.color,
    }));

    return {
      handled: true,
      summary: `Spending breakdown by tag (${windowLabel}):`,
      details,
      chartData,
      intent: { ...intent, summary: `Tag breakdown ${windowLabel}`, chartData },
    };
  }

  // --- Velocity ---
  if (subtype === "velocity") {
    const days = timeframe === "week" ? 7 : 30;
    const vel = getVelocity(transactions, days);

    if (vel.txCount === 0) {
      return {
        handled: true,
        summary: `No outgoing transactions found in the last ${days} days.`,
        intent,
      };
    }

    const totalStr = formatAssetSums(vel.totalByAsset);
    const avgStr = Object.entries(vel.dailyAvgByAsset)
      .map(([asset, avg]) => `${avg.toFixed(4)} ${asset}/day`)
      .join(", ");

    const details = [
      `Period: ${days}-day rolling window`,
      `Total Sent: ${totalStr}`,
      `Daily Average: ${avgStr}`,
      `Transaction Count: ${vel.txCount}`,
    ];

    return {
      handled: true,
      summary: `${days}-day spending velocity: ${totalStr} sent across ${vel.txCount} transaction(s).`,
      details,
      chartData: vel.chartData,
      intent: { ...intent, summary: `${days}-day velocity`, chartData: vel.chartData },
    };
  }

  // --- Counterparty Detail ---
  if (subtype === "counterparty_detail" && counterparty) {
    const detail = getCounterpartyDetail(transactions, counterparty, timeframe);
    if (!detail) {
      return {
        handled: true,
        summary: `No outgoing transactions found for counterparty "${counterparty}" ${timeframe ? windowLabel : ""}.`,
        intent,
      };
    }

    const totalStr = formatAssetSums(detail.totalByAsset);
    const firstDate = detail.firstSeen
      ? new Date(detail.firstSeen).toLocaleDateString()
      : "unknown";
    const lastDate = detail.lastSeen
      ? new Date(detail.lastSeen).toLocaleDateString()
      : "unknown";

    const details = [
      `Counterparty: ${formatCounterparty(detail.counterparty)}`,
      `Total Sent: ${totalStr}`,
      `Transaction Count: ${detail.txCount}`,
      `First Transaction: ${firstDate}`,
      `Last Transaction: ${lastDate}`,
      `Tags Used: ${detail.tags.join(", ")}`,
    ];

    const chartData = Object.entries(detail.totalByAsset).map(([asset, value]) => ({
      label: asset,
      value,
    }));

    return {
      handled: true,
      summary: `Spending detail for ${formatCounterparty(detail.counterparty)}: ${totalStr} sent across ${detail.txCount} transaction(s) ${timeframe ? windowLabel : "overall"}.`,
      details,
      chartData,
      intent: {
        ...intent,
        summary: `Counterparty detail: ${formatCounterparty(detail.counterparty)}`,
        chartData,
      },
    };
  }

  return {
    handled: true,
    summary: "Spending analytics query could not be resolved. Please specify a timeframe or counterparty.",
    intent,
  };
}
