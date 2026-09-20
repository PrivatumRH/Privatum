/**
 * Local Natural Language Spending Analytics Intelligence for PRIVATUM Assistant.
 *
 * Resolves conversational spending-audit queries against the local ledger,
 * including counterparty velocity analysis, tag-level cost-center breakdowns,
 * and rolling-window activity summaries.
 *
 * 100% client-side and deterministic: executes in device memory with zero external queries.
 */

import { runSpendingAnalytics, type AnalyticsTransaction } from "../spendingAnalytics";
import type { ParsedSpendingAnalyticsIntent } from "./types";
import type { SpendingAnalyticsResult } from "../spendingAnalytics";


export interface SpendingAnalyticsContext {
  transactionHistory?: AnalyticsTransaction[];
}

/**
 * Evaluates natural-language spending analytics queries.
 * Returns a result if the input matches a known analytics pattern, or null otherwise.
 */
export function evaluateSpendingAnalytics(
  input: string,
  context: SpendingAnalyticsContext
): SpendingAnalyticsResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();
  const transactions = context.transactionHistory || [];

  // Detect timeframe
  let timeframe: "week" | "month" | undefined;
  if (/this\s+week|7[-\s]?day|past\s+week|last\s+7/i.test(lower)) timeframe = "week";
  else if (/this\s+month|30[-\s]?day|past\s+month|last\s+30/i.test(lower)) timeframe = "month";

  // 1. Velocity query
  // "my 7-day spending velocity", "30-day velocity", "how fast am I spending", "spending rate"
  if (
    /\b(?:velocity|spending\s+rate|spend\s+rate|how\s+fast\s+(?:am\s+i|are\s+i)\s+spending)\b/i.test(lower) ||
    /\b(?:7|7-day|30|30-day)\s*day\s+(?:spending\s+)?velocity\b/i.test(lower)
  ) {
    const intent: ParsedSpendingAnalyticsIntent = {
      type: "spending_analytics",
      subtype: "velocity",
      timeframe: timeframe ?? (lower.includes("30") ? "month" : "week"),
      summary: "",
      details: [],
    };
    return runSpendingAnalytics(intent, transactions);
  }

  // 2. Top counterparty ranking
  // "who did I pay the most", "top counterparties", "who received the most from me"
  if (
    /who\s+did\s+i\s+(?:pay|send|transfer)\s+(?:the\s+)?most/i.test(lower) ||
    /top\s+(?:\d+\s+)?counterpart(?:y|ies)/i.test(lower) ||
    /who\s+(?:received|got)\s+(?:the\s+)?most\s+from\s+(?:me|my\s+wallet)/i.test(lower) ||
    /largest\s+(?:recipient|counterpart)/i.test(lower) ||
    /my\s+(?:biggest|top|largest)\s+(?:payment|spend|recipient)/i.test(lower)
  ) {
    const intent: ParsedSpendingAnalyticsIntent = {
      type: "spending_analytics",
      subtype: "top_counterparties",
      timeframe,
      summary: "",
      details: [],
    };
    return runSpendingAnalytics(intent, transactions);
  }

  // 3. Tag breakdown
  // "what is my spending breakdown by tag", "tag breakdown", "spending by cost center"
  if (
    /spending\s+breakdown\s+by\s+tag/i.test(lower) ||
    /tag\s+breakdown/i.test(lower) ||
    /spend(?:ing)?\s+by\s+(?:tag|cost[\s-]?center|category)/i.test(lower) ||
    /breakdown\s+(?:by|of|across)\s+(?:tags?|cost[\s-]?centers?|categories)/i.test(lower) ||
    /how\s+(?:much|is)\s+(?:my\s+)?spending\s+(?:split|divided|broken\s+down)\s+by\s+tag/i.test(lower)
  ) {
    const intent: ParsedSpendingAnalyticsIntent = {
      type: "spending_analytics",
      subtype: "tag_breakdown",
      timeframe,
      summary: "",
      details: [],
    };
    return runSpendingAnalytics(intent, transactions);
  }

  // 4. Counterparty detail
  // "how much did I send to Alice this week", "how much did I pay 0x...", "spending with Alice"
  const counterpartyDetailMatch =
    lower.match(/how\s+much\s+did\s+i\s+(?:send|pay|transfer)\s+to\s+(.+?)(?:\s+(?:this\s+week|this\s+month|last\s+7|last\s+30|in\s+total))?$/i) ||
    lower.match(/(?:spending|payments?)\s+(?:to|with)\s+(.+?)(?:\s+(?:this\s+week|this\s+month))?$/i);

  if (counterpartyDetailMatch) {
    const rawCounterparty = counterpartyDetailMatch[1]
      .replace(/\s+(this\s+week|this\s+month|last\s+\d+\s+days?|in\s+total|overall)$/i, "")
      .trim();

    if (rawCounterparty.length > 0) {
      const intent: ParsedSpendingAnalyticsIntent = {
        type: "spending_analytics",
        subtype: "counterparty_detail",
        counterparty: rawCounterparty,
        timeframe,
        summary: "",
        details: [],
      };
      return runSpendingAnalytics(intent, transactions);
    }
  }

  // 5. Fallback: generic "analytics" / "spending analysis" or "audit"
  if (
    /spending\s+analytics/i.test(lower) ||
    /spending\s+audit/i.test(lower) ||
    /transaction\s+analytics/i.test(lower) ||
    /(?:show|give\s+me)\s+(?:my\s+)?spending\s+(?:summary|report|overview)/i.test(lower)
  ) {
    // Default to tag breakdown as the most informative overview
    const intent: ParsedSpendingAnalyticsIntent = {
      type: "spending_analytics",
      subtype: "tag_breakdown",
      timeframe,
      summary: "",
      details: [],
    };
    return runSpendingAnalytics(intent, transactions);
  }

  return null;
}
