/**
 * Holistic Wallet Health & Security Audit Engine for PRIVATUM Desktop.
 *
 * Evaluates spending guardrails, counterparty threat defense, 7-day velocity,
 * outbox transmission state, and ledger hygiene into a deterministic score and grade.
 *
 * 100% client-side and deterministic: executes in memory with zero external telemetry.
 */

import type { Contact } from "./contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "./spendGuardrails";
import { ROLLING_WINDOW_MS, estimateUsdValue } from "./spendGuardrails";
import type { WhitelistEntry, WhitelistConfig } from "./transferWhitelist";
import type { BlacklistEntry } from "./transferBlacklist";
import { CURATED_THREAT_FEED, checkAddressBlacklist } from "./transferBlacklist";
import { checkAddressPoisoning, type AddressGuardHistoryEntry } from "./addressGuard";
import type { OfflineTransaction } from "./offlineOutbox";
import type { ParsedWalletHealthReportIntent } from "./assistant/types";

export interface WalletHealthReportContext {
  walletAddress?: string;
  contacts?: Contact[];
  guardrailConfig?: SpendingGuardrailConfig;
  spendingHistory?: SpendingRecord[];
  transactionHistory?: {
    type: "send" | "receive";
    counterparty: string;
    amount: string;
    asset: string;
    timestamp?: number;
    hash?: string;
    tag?: string;
  }[];
  offlineOutbox?: OfflineTransaction[];
  isOnline?: boolean;
  forceAirGap?: boolean;
  confirmedNonce?: number;
  whitelistEntries?: WhitelistEntry[];
  whitelistConfig?: WhitelistConfig;
  blacklistEntries?: BlacklistEntry[];
}

export interface WalletHealthReport {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "Warning";
  summary: string;
  details: string[];
  pillars: ParsedWalletHealthReportIntent["pillars"];
  recommendations: string[];
  intent: ParsedWalletHealthReportIntent;
}

/**
 * Parses numeric amount cleanly.
 */
function parseAmount(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Generate a complete, holistic health audit over current wallet state.
 */
export function generateWalletHealthReport(
  context: WalletHealthReportContext
): WalletHealthReport {
  const {
    walletAddress = "",
    contacts = [],
    guardrailConfig,
    spendingHistory = [],
    transactionHistory = [],
    offlineOutbox = [],
    whitelistEntries = [],
    whitelistConfig = { strictMode: false },
    blacklistEntries = [],
  } = context;

  const now = Date.now();
  let score = 100;
  const recommendations: string[] = [];

  // =========================================================================
  // PILLAR 1: Spending Guardrails & Budget Headroom
  // =========================================================================
  let guardrailStatus: "healthy" | "warning" | "disabled" = "healthy";
  let guardrailUsagePercent = 0;
  let guardrailDetail = "";

  if (!guardrailConfig || !guardrailConfig.enabled) {
    guardrailStatus = "disabled";
    guardrailDetail = "Spending guardrails are currently disabled. Transfers have no client-side single or daily spending limits.";
    score -= 25;
    recommendations.push("Enable spending guardrails to enforce daily limits and protect against unauthorized drain.");
  } else {
    const windowCutoff = now - ROLLING_WINDOW_MS;
    const recentRecords = spendingHistory.filter((r) => r.timestamp >= windowCutoff);
    const consumed24h = recentRecords.reduce((sum, r) => sum + (r.amountUsd || 0), 0);
    const dailyLimit = Math.max(1, guardrailConfig.dailyLimitUsd);

    guardrailUsagePercent = Math.min(100, Math.round((consumed24h / dailyLimit) * 100));

    if (guardrailUsagePercent >= 100) {
      guardrailStatus = "warning";
      guardrailDetail = `Daily limit reached: $${consumed24h.toFixed(2)} / $${dailyLimit.toFixed(2)} USD (100% capacity consumed).`;
      score -= 20;
      recommendations.push("Daily spending limit exhausted. Additional transfers require explicit override or capacity release.");
    } else if (guardrailUsagePercent >= 80) {
      guardrailStatus = "warning";
      guardrailDetail = `Near daily limit: $${consumed24h.toFixed(2)} / $${dailyLimit.toFixed(2)} USD (${guardrailUsagePercent}% consumed).`;
      score -= 10;
      recommendations.push("Daily spend is above 80% capacity. Monitor remaining headroom before initiating high-value transfers.");
    } else {
      guardrailStatus = "healthy";
      guardrailDetail = `Healthy headroom: $${consumed24h.toFixed(2)} / $${dailyLimit.toFixed(2)} USD (${guardrailUsagePercent}% consumed).`;
      if (guardrailConfig.strictMode) {
        score += 5;
      }
    }

    if (!guardrailConfig.strictMode && guardrailUsagePercent > 60) {
      recommendations.push("Consider activating Strict Guardrail Enforcement to automatically block transfers exceeding the daily cap.");
    }
  }

  // =========================================================================
  // PILLAR 2: Counterparty Security & Threat Defense
  // =========================================================================
  let securityStatus: "healthy" | "warning" | "danger" = "healthy";
  let securityThreatDetail = "";

  const whitelistCount = whitelistEntries.length;
  const totalBlacklistCount = CURATED_THREAT_FEED.length + blacklistEntries.length;

  const historyEntries: AddressGuardHistoryEntry[] = transactionHistory.map((t) => ({
    type: t.type,
    counterparty: t.counterparty,
    amount: t.amount,
    asset: t.asset,
  }));
  const ownAddrs = [walletAddress, ...contacts.map((c) => c.address)].filter(Boolean);

  let poisoningFlagCount = 0;
  let blacklistedHitCount = 0;

  for (const tx of transactionHistory.filter((t) => t.type === "send")) {
    if (!tx.counterparty || !tx.counterparty.startsWith("0x")) continue;

    const verdict = checkAddressPoisoning({
      recipient: tx.counterparty,
      history: historyEntries,
      ownAddresses: ownAddrs,
    });
    if (verdict.level === "danger" || verdict.level === "warning") {
      poisoningFlagCount++;
    }

    const blCheck = checkAddressBlacklist(tx.counterparty, blacklistEntries);
    if (blCheck?.isBlacklisted) {
      blacklistedHitCount++;
    }
  }

  if (blacklistedHitCount > 0) {
    securityStatus = "danger";
    securityThreatDetail = `CRITICAL: ${blacklistedHitCount} past counterparty destination(s) match known threat feed blacklists!`;
    score -= 35;
    recommendations.push("Audit past recipient addresses immediately: known malicious or phishing drainer detected in transaction history.");
  } else if (poisoningFlagCount > 0) {
    securityStatus = "warning";
    securityThreatDetail = `Warning: ${poisoningFlagCount} recipient address(es) exhibit lookalike suffix/prefix vanity spoofing characteristics.`;
    score -= 20;
    recommendations.push("Verify recipient addresses from your encrypted Address Book; potential address poisoning dust detected.");
  } else if (whitelistCount === 0) {
    securityStatus = "warning";
    securityThreatDetail = `No approved whitelist counterparties defined. All ${totalBlacklistCount} curated threat rules are active.`;
    score -= 10;
    recommendations.push("Add frequent counterparties to your approved Whitelist to prevent misrouted transactions.");
  } else {
    securityStatus = "healthy";
    securityThreatDetail = `${whitelistCount} approved whitelist entries, ${totalBlacklistCount} threat rules active, 0 lookalike anomalies.`;
    if (whitelistConfig.strictMode) {
      score += 5;
    }
  }

  // =========================================================================
  // PILLAR 3: Cashflow Dynamics & Velocity
  // =========================================================================
  let velocityStatus: "healthy" | "elevated" | "low" = "healthy";
  const sevenDayCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const recentWeekSends = transactionHistory.filter(
    (t) => t.type === "send" && t.timestamp !== undefined && t.timestamp >= sevenDayCutoff
  );

  let sevenDayTotalUsd = 0;
  for (const tx of recentWeekSends) {
    sevenDayTotalUsd += estimateUsdValue(tx.amount, tx.asset);
  }
  const dailyAverageUsd = parseFloat((sevenDayTotalUsd / 7).toFixed(2));
  let velocityDetail = "";

  const dailyCap = guardrailConfig?.dailyLimitUsd || 500;
  if (dailyAverageUsd > dailyCap * 0.9) {
    velocityStatus = "elevated";
    velocityDetail = `Elevated 7-day velocity: $${sevenDayTotalUsd.toFixed(2)} USD sent ($${dailyAverageUsd.toFixed(2)}/day, ${recentWeekSends.length} txs).`;
    score -= 10;
    recommendations.push("7-day burn rate is running close to your 24h guardrail capacity. Plan upcoming payouts accordingly.");
  } else if (recentWeekSends.length === 0) {
    velocityStatus = "low";
    velocityDetail = `Low activity: $0.00 USD sent in the past 7 days across 0 outgoing transactions.`;
  } else {
    velocityStatus = "healthy";
    velocityDetail = `Stable 7-day velocity: $${sevenDayTotalUsd.toFixed(2)} USD sent ($${dailyAverageUsd.toFixed(2)}/day across ${recentWeekSends.length} txs).`;
  }

  // =========================================================================
  // PILLAR 4: Ledger Hygiene & Outbox State
  // =========================================================================
  let hygieneStatus: "healthy" | "needs_attention" = "healthy";
  const allSends = transactionHistory.filter((t) => t.type === "send");
  const untaggedSends = allSends.filter((t) => !t.tag || t.tag === "Untagged" || t.tag === "Other");
  const untaggedCount = untaggedSends.length;

  const outboxPending = offlineOutbox.filter((t) => t.status === "queued" || t.status === "broadcasting").length;
  const outboxFailed = offlineOutbox.filter((t) => t.status === "failed").length;

  let hygieneDetail = "";
  if (outboxFailed > 0) {
    hygieneStatus = "needs_attention";
    hygieneDetail = `Offline Outbox has ${outboxFailed} failed transaction(s) requiring broadcast retry or cancellation.`;
    score -= 15;
    recommendations.push(`Review Offline Outbox: ${outboxFailed} failed transaction(s) need clearance or retry.`);
  } else if (outboxPending > 3) {
    hygieneStatus = "needs_attention";
    hygieneDetail = `${outboxPending} queued transfers awaiting broadcast. ${untaggedCount} outgoing transaction(s) without cost-center tags.`;
    score -= 5;
    recommendations.push(`${outboxPending} signed transactions queued in outbox. Broadcast when network connectivity is confirmed.`);
  } else if (allSends.length >= 3 && untaggedCount / allSends.length > 0.5) {
    hygieneStatus = "needs_attention";
    hygieneDetail = `${untaggedCount} of ${allSends.length} transactions lack cost-center tags (${Math.round((untaggedCount / allSends.length) * 100)}% untagged).`;
    score -= 5;
    recommendations.push("Tag recent transactions (e.g. Payroll, Vendor, Operations) for granular tax and cost-center reporting.");
  } else {
    hygieneStatus = "healthy";
    hygieneDetail = `Ledger organized: ${allSends.length - untaggedCount}/${allSends.length} tagged. Outbox queue clear (${outboxPending} pending, ${outboxFailed} failed).`;
  }

  // =========================================================================
  // Final Score & Grade Calibration
  // =========================================================================
  const clampedScore = Math.max(10, Math.min(100, Math.round(score)));

  let grade: "A+" | "A" | "B" | "C" | "Warning" = "A";
  if (clampedScore >= 95) grade = "A+";
  else if (clampedScore >= 85) grade = "A";
  else if (clampedScore >= 70) grade = "B";
  else if (clampedScore >= 50) grade = "C";
  else grade = "Warning";

  if (recommendations.length === 0) {
    recommendations.push("Wallet health is optimal. No active security warnings or budget anomalies detected.");
  }

  const pillars = {
    guardrails: {
      status: guardrailStatus,
      usagePercent: guardrailUsagePercent,
      detail: guardrailDetail,
    },
    security: {
      status: securityStatus,
      whitelistCount,
      blacklistCount: totalBlacklistCount,
      detail: securityThreatDetail,
    },
    velocity: {
      status: velocityStatus,
      sevenDayTotalUsd,
      dailyAverageUsd,
      detail: velocityDetail,
    },
    hygiene: {
      status: hygieneStatus,
      untaggedCount,
      outboxPending,
      detail: hygieneDetail,
    },
  };

  const summary = `Wallet Health Audit: Score ${clampedScore}/100 (Grade ${grade}). All 4 operational pillars verified.`;

  const details = [
    `Overall Health Score: ${clampedScore}/100 [Grade ${grade}]`,
    `Guardrail Headroom: ${guardrailStatus.toUpperCase()} (${guardrailDetail})`,
    `Security & Threat Defense: ${securityStatus.toUpperCase()} (${securityThreatDetail})`,
    `7-Day Spending Velocity: ${velocityStatus.toUpperCase()} (${velocityDetail})`,
    `Ledger Hygiene & Outbox: ${hygieneStatus === "healthy" ? "HEALTHY" : "ATTENTION NEEDED"} (${hygieneDetail})`,
  ];

  const intent: ParsedWalletHealthReportIntent = {
    type: "wallet_health_report",
    summary,
    score: clampedScore,
    grade,
    pillars,
    recommendations,
  };

  return {
    score: clampedScore,
    grade,
    summary,
    details,
    pillars,
    recommendations,
    intent,
  };
}
