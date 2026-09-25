/**
 * Local Natural Language Guardrail Capacity Forecasting & Budget Runway for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding:
 * 1. Forward-looking spending runway and daily limit exhaustion forecasting.
 * 2. Queued outbox capacity impact and pending guardrail breach alerts.
 * 3. Rolling 24-hour reset predictions and capacity replenishment schedules.
 * 4. Trailing velocity and daily burn rate modeling.
 *
 * 100% client-side deterministic evaluation with zero external analytics tracking.
 */

import {
  generateBudgetRunwayReport,
  type BudgetRunwayContext,
  type BudgetRunwayReport,
} from "../budgetRunway";
import type { ParsedBudgetRunwayIntent } from "./types";

export interface BudgetRunwayQueryResult {
  handled: true;
  summary: string;
  details: string[];
  report: BudgetRunwayReport;
  intent: ParsedBudgetRunwayIntent;
}

/**
 * Checks if input represents a budget runway, capacity forecast, or rolling reset query.
 */
export function evaluateBudgetRunwayQuery(
  input: string,
  context: BudgetRunwayContext = {}
): BudgetRunwayQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const isRunwayQuery =
    /\b(?:budget\s+runway|spending\s+runway|how\s+much\s+runway|forecast\s+(?:my\s+)?runway|runway\s+forecast|runway\s+projection)\b/i.test(
      lower
    );

  const isCapacityQuery =
    /\b(?:guardrail\s+capacity|capacity\s+forecast|spending\s+capacity|remaining\s+capacity|headroom\s+forecast|spending\s+trajectory)\b/i.test(
      lower
    );

  const isQueuedBreachQuery =
    /\b(?:will\s+(?:my\s+)?queued\s+(?:batch|transfers?|outbox)\s+(?:exceed|breach|surpass|fit)|can\s+i\s+afford\s+(?:my\s+)?queued|outbox\s+guardrail\s+impact)\b/i.test(
      lower
    );

  const isResetTimeQuery =
    /\b(?:when\s+(?:will|does)\s+(?:my\s+)?(?:spending\s+)?limit\s+reset|when\s+(?:will|does)\s+headroom\s+reset|next\s+reset\s+time|when\s+does\s+guardrail\s+reset)\b/i.test(
      lower
    );

  const isCompositeTrigger =
    /\b(?:runway|budget|headroom|burn\s+rate)\b/i.test(lower) &&
    /\b(?:forecast|trajectory|deplet|exhaust|reset|predict|projection|left\s+this\s+week)\b/i.test(
      lower
    );

  if (
    !isRunwayQuery &&
    !isCapacityQuery &&
    !isQueuedBreachQuery &&
    !isResetTimeQuery &&
    !isCompositeTrigger
  ) {
    return null;
  }

  const report = generateBudgetRunwayReport(context);

  const details: string[] = [
    `Daily Limit: $${report.dailyLimitUsd.toFixed(2)} ($${report.current24hSpentUsd.toFixed(2)} spent in past 24h)`,
    `Remaining Headroom: $${report.remainingHeadroomUsd.toFixed(2)} (${report.headroomPercent}% capacity)`,
    `Burn Rate: Trailing 24h: $${report.burnRate24hUsd.toFixed(2)}, Trailing 7d average: $${report.burnRate7dUsd.toFixed(2)}/day`,
    `Projected Runway: ${report.formattedRunway}`,
    `Next Rolling Reset: ${report.resetWindow.formattedTimeUntilReset}${report.resetWindow.amountExpiringUsd > 0 ? ` (unlocks +$${report.resetWindow.amountExpiringUsd.toFixed(2)})` : ""}`,
  ];

  if (report.queuedOutboxCount > 0) {
    details.push(
      `Queued Outbox Impact: ${report.queuedOutboxCount} transfer(s) totaling $${report.queuedOutboxTotalUsd.toFixed(2)} (${report.willQueuedExceedLimit ? "BREACHES LIMIT" : "fits within limit"})`
    );
  }

  if (report.recommendations.length > 0) {
    details.push(...report.recommendations);
  }

  return {
    handled: true,
    summary: report.summary,
    details,
    report,
    intent: {
      type: "budget_runway",
      report,
    },
  };
}
