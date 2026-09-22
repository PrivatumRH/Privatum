/**
 * Local Natural Language Pre-Flight Batch & Multi-Pay Evaluator for PRIVATUM Assistant.
 *
 * Resolves conversational multi-recipient transfers, checks guardrails & address security,
 * and builds atomic batch payment proposals.
 *
 * 100% client-side and deterministic: executes in memory with zero external telemetry.
 */

import {
  parseBatchPaymentPrompt,
  evaluateBatchPreflight,
  type BatchPaymentContext,
  type ParsedBatchPayment,
} from "../batchPayment";
import type { ParsedBatchPaymentIntent } from "./types";

export interface BatchQueryResult {
  handled: true;
  summary: string;
  details: string[];
  batch: ParsedBatchPayment;
  intent: ParsedBatchPaymentIntent;
}

/**
 * Checks if an input prompt represents a batch payment or multi-recipient payout command.
 */
export function evaluateBatchPaymentQuery(
  input: string,
  context: BatchPaymentContext = {}
): BatchQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Quick pre-filter: must have at least some payment or batch intent indicators
  const hasPaymentVerb = /\b(?:pay|send|transfer|payout|batch)\b/i.test(lower);
  if (!hasPaymentVerb) {
    return null;
  }

  const parsed = parseBatchPaymentPrompt(clean, context.contacts);
  if (!parsed || parsed.items.length < 2) {
    return null;
  }

  const evaluated = evaluateBatchPreflight(parsed, context);

  // Build human-readable summary
  const totalsStr = Object.entries(evaluated.totalAmounts)
    .map(([asset, amt]) => `${amt.toFixed(2)} ${asset}`)
    .join(", ");

  const scheduleNote =
    evaluated.isScheduled && evaluated.scheduledDelay
      ? ` [Scheduled: ${evaluated.scheduledDelay}]`
      : "";

  const summary = `Pre-Flight Batch Payment Proposal: ${evaluated.itemCount} transfers totalling ${totalsStr}${scheduleNote}. Gas savings: ~${evaluated.estimatedGasSavingsPercent}%.`;

  const details: string[] = [];

  // Itemized breakdown
  details.push(`Transfers (${evaluated.itemCount} recipients):`);
  for (const item of evaluated.items) {
    const target = item.recipientName
      ? `${item.recipientName} (${item.recipient.slice(0, 6)}...${item.recipient.slice(-4)})`
      : `${item.recipient.slice(0, 8)}...${item.recipient.slice(-6)}`;
    const tagStr = item.tag ? ` [${item.tag}]` : "";
    const stealthStr = item.isStealth ? " [Stealth]" : "";
    details.push(`* ${item.amount} ${item.asset} to ${target}${tagStr}${stealthStr}`);
  }

  // Preflight checks summary
  details.push("");
  details.push("Pre-Flight Verification Status:");
  for (const check of evaluated.checks) {
    const icon =
      check.status === "pass" ? "[PASS]" : check.status === "warn" ? "[WARN]" : "[FAIL]";
    details.push(`* ${icon} ${check.label}: ${check.message}`);
  }

  const intent: ParsedBatchPaymentIntent = {
    type: "batch_payment",
    items: evaluated.items,
    totalAmounts: evaluated.totalAmounts,
    itemCount: evaluated.itemCount,
    scheduledDelay: evaluated.scheduledDelay,
    isScheduled: evaluated.isScheduled,
    estimatedGasSavingsPercent: evaluated.estimatedGasSavingsPercent,
    checks: evaluated.checks,
    allChecksPassed: evaluated.allChecksPassed,
  };

  return {
    handled: true,
    summary,
    details,
    batch: evaluated,
    intent,
  };
}
