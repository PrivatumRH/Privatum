/**
 * Local Natural Language Wallet Health & Audit Query Evaluator for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries requesting whole-wallet health audits,
 * diagnostic scorecards, and multi-pillar risk assessments.
 *
 * 100% client-side and deterministic: executes in memory with zero external telemetry.
 */

import {
  generateWalletHealthReport,
  type WalletHealthReportContext,
  type WalletHealthReport,
} from "../walletHealthReport";

export interface WalletHealthQueryResult {
  handled: boolean;
  summary: string;
  details?: string[];
  report?: WalletHealthReport;
  intent?: WalletHealthReport["intent"];
}

/**
 * Checks if input matches a wallet health or holistic audit query.
 */
export function evaluateWalletHealthQuery(
  input: string,
  context: WalletHealthReportContext
): WalletHealthQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Pattern matching for wallet health / audit requests
  const isHealthQuery =
    /\b(?:wallet\s+health|health\s+report|health\s+audit|wallet\s+audit|audit\s+(?:my\s+)?wallet|how\s+healthy\s+is\s+(?:my\s+)?wallet|financial\s+health|wallet\s+diagnostic(?:s)?|diagnose\s+(?:my\s+)?wallet|wallet\s+scorecard|wallet\s+report\s+card|overall\s+wallet\s+status|complete\s+wallet\s+check)\b/i.test(
      lower
    ) ||
    (/\b(?:health\s+check|health\s+status)\b/i.test(lower) && !lower.includes("server") && !lower.includes("node"));

  if (!isHealthQuery) {
    return null;
  }

  const report = generateWalletHealthReport(context);

  const lines = [
    `Wallet Health Grade: ${report.grade} (Score: ${report.score}/100)`,
    "",
    `* Spending Guardrails: ${report.pillars.guardrails.detail}`,
    `* Security & Whitelist: ${report.pillars.security.detail}`,
    `* 7-Day Velocity: ${report.pillars.velocity.detail}`,
    `* Ledger Hygiene & Outbox: ${report.pillars.hygiene.detail}`,
  ];

  if (report.recommendations && report.recommendations.length > 0) {
    lines.push("");
    lines.push("Actionable Recommendations:");
    for (const rec of report.recommendations) {
      lines.push(`* ${rec}`);
    }
  }

  return {
    handled: true,
    summary: report.summary,
    details: lines,
    report,
    intent: report.intent,
  };
}
