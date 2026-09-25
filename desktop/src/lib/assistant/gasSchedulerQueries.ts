/**
 * Local Natural Language Gas-Optimal Congestion Scheduler & Outbox Fee Optimizer for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding:
 * 1. Current network congestion and gas market conditions.
 * 2. Optimal diurnal windows for broadcasting queued payments.
 * 3. Outbox gas fee projections and savings estimations.
 * 4. Automated fee optimization proposals before executing onchain.
 *
 * 100% client-side and deterministic: executes in memory with zero external telemetry.
 */

import {
  generateGasOptimizationReport,
  type GasSchedulerContext,
  type GasOptimizationReport,
} from "../gasScheduler";
import type { ParsedGasSchedulerIntent } from "./types";

export interface GasSchedulerQueryResult {
  handled: true;
  summary: string;
  details: string[];
  report: GasOptimizationReport;
  intent: ParsedGasSchedulerIntent;
}

/**
 * Checks if input represents a gas market, congestion schedule, or outbox fee optimization query.
 */
export function evaluateGasSchedulerQuery(
  input: string,
  context: GasSchedulerContext = {}
): GasSchedulerQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Pattern detection for gas scheduling, congestion, and outbox optimization
  const isCheapestTimeQuery =
    /\b(?:when\s+(?:is|are)\s+(?:the\s+)?cheapest\s+time|best\s+time\s+to\s+(?:broadcast|send|relay)|cheapest\s+window\s+to\s+(?:send|broadcast)|optimal\s+(?:time|window)\s+to\s+(?:broadcast|send))\b/i.test(
      lower
    );

  const isGasOptimizationQuery =
    /\b(?:optimize\s+(?:gas|fees?|outbox)|gas\s+optimiz(?:er|ation)|fee\s+optimiz(?:er|ation)|reduce\s+gas\s+costs?|save\s+(?:on\s+)?gas)\b/i.test(
      lower
    );

  const isCongestionQuery =
    /\b(?:gas\s+congestion|check\s+gas|is\s+gas\s+(?:cheap|high|expensive|low|spiking)|current\s+gas\s+(?:price|fees?|rate)|what\s+(?:is|are)\s+(?:current\s+)?gas\s+(?:price|fees?)|gas\s+market)\b/i.test(
      lower
    );

  const isScheduleBatchQuery =
    /\b(?:schedule\s+(?:queued\s+)?(?:batch|outbox|transfers?|payments?)\s+for\s+low\s+gas|schedule\s+(?:for\s+)?low\s+gas|broadcast\s+when\s+gas\s+is\s+low)\b/i.test(
      lower
    );

  const isCompositeTrigger =
    /\b(?:gas|gwei|basefee|priority\s+fee)\b/i.test(lower) &&
    /\b(?:schedule|scheduler|congestion|forecast|optimal|cheapest|off-peak|window|outbox)\b/i.test(lower);

  if (
    !isCheapestTimeQuery &&
    !isGasOptimizationQuery &&
    !isCongestionQuery &&
    !isScheduleBatchQuery &&
    !isCompositeTrigger
  ) {
    return null;
  }

  const report = generateGasOptimizationReport(context);

  const details: string[] = [
    `* Current Gas Rate: ${report.currentGwei.toFixed(2)} Gwei (Market State: ${report.congestion.currentTier.toUpperCase()})`,
    `* Optimal Off-Peak Window: ${report.congestion.bestWindowUtc} (~${report.congestion.estimatedWaitHours}h wait)`,
    `* Target Gwei Rate: <= ${report.targetGweiThreshold.toFixed(2)} Gwei`,
  ];

  if (report.outboxAnalysis.queuedCount > 0) {
    details.push(
      `* Queued Outbox Items: ${report.outboxAnalysis.queuedCount} transfer(s) across ${report.outboxAnalysis.totalGasUnits.toLocaleString()} total gas units`
    );
    details.push(
      `* Current Estimated Gas: ~$${report.outboxAnalysis.currentCostUsd.toFixed(2)} (${report.outboxAnalysis.currentCostEth.toFixed(6)} ETH)`
    );
    if (report.outboxAnalysis.projectedSavingsPercent > 0) {
      details.push(
        `* Projected Off-Peak Savings: ~$${report.outboxAnalysis.projectedSavingsUsd.toFixed(2)} (~${report.outboxAnalysis.projectedSavingsPercent}% reduction)`
      );
    }
  } else {
    details.push("* Outbox Queue: Clear (no pending transfers currently awaiting broadcast)");
  }

  if (report.actionableAdvice.length > 0) {
    details.push("");
    details.push("Optimization Strategy:");
    for (const advice of report.actionableAdvice) {
      details.push(`- ${advice}`);
    }
  }

  return {
    handled: true,
    summary: report.summary,
    details,
    report,
    intent: {
      type: "gas_scheduler",
      report,
    },
  };
}
