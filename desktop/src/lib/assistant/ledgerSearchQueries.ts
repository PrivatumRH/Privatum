/**
 * Local Natural Language Ledger Search & Recall Evaluator for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries requesting multi-dimensional filtering
 * across cost-center tags, counterparties, amount limits, assets, and timeframes.
 *
 * 100% client-side and deterministic: executes in memory with zero external telemetry.
 */

import type { Contact } from "../contacts";
import {
  parseLedgerSearchFilters,
  executeLedgerSearch,
  type LedgerSearchTransaction,
  type LedgerSearchResult,
} from "../ledgerSearch";
import { TRANSACTION_TAGS } from "../transactionTags";

export interface LedgerSearchContext {
  transactionHistory?: LedgerSearchTransaction[];
  contacts?: Contact[];
}

/**
 * Checks if an input prompt represents a ledger search or recall query.
 */
export function evaluateLedgerSearchQuery(
  input: string,
  context: LedgerSearchContext
): LedgerSearchResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();
  const transactions = context.transactionHistory || [];
  const contacts = context.contacts || [];

  // 1. Explicit search keywords
  const hasExplicitSearchVerb =
    /^(?:find|search|filter|show|list|recall|get)\s+(?:all\s+)?(?:the\s+)?(?:transactions|transfers|payments|records|history|ledger|txs)\b/i.test(
      lower
    ) ||
    /\b(?:search\s+(?:my\s+)?ledger|find\s+(?:in\s+)?(?:my\s+)?ledger|ledger\s+search)\b/i.test(
      lower
    );

  // 2. Tag-specific queries (e.g. "all payroll transactions", "show vendor payments", "tax deductible expenses")
  const tagMentioned = TRANSACTION_TAGS.find((t) => lower.includes(t.toLowerCase()));
  const hasTagQuery =
    Boolean(tagMentioned) &&
    /\b(?:transactions?|payments?|transfers?|records?|expenses?|spend(?:ing)?|costs?)\b/i.test(
      lower
    ) &&
    !lower.includes("what is my spending breakdown") && // avoid stealing tag_breakdown analytics
    !lower.includes("spending breakdown by tag");

  // 3. Amount-bounded queries (e.g. "payments over 100 usdg", "transfers under 50 eth", "transactions between 20 and 50")
  const hasAmountBoundQuery =
    /\b(?:transactions?|transfers?|payments?)\s+(?:over|greater than|above|under|less than|below|between)\s+[\d.]+/i.test(
      lower
    ) ||
    /\b(?:all\s+)?(?:payments?|transfers?)\s+(?:over|under|between)\s+[\d.]+/i.test(lower);

  // 4. Time-bounded search queries (e.g. "what did I send between Sept 1 and Sept 15", "transactions in september", "payments to alice this month")
  const hasTimeSearch =
    /\b(?:transactions?|transfers?|payments?)\s+(?:in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|last\s+month)\b/i.test(
      lower
    ) ||
    /\b(?:show|find|list)\s+(?:all\s+)?(?:payments?|transfers?|txs?)\s+to\s+[a-zA-Z0-9_\- ]+/i.test(
      lower
    );

  if (!hasExplicitSearchVerb && !hasTagQuery && !hasAmountBoundQuery && !hasTimeSearch) {
    return null;
  }

  // Parse filters
  const filters = parseLedgerSearchFilters(clean, contacts);

  // If no filters were extracted and it's not an explicit search command, return null
  const hasAnyFilter =
    Boolean(filters.tag) ||
    Boolean(filters.counterparty) ||
    Boolean(filters.counterpartyName) ||
    Boolean(filters.asset) ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined ||
    filters.startTimestamp !== undefined ||
    filters.direction !== "all";

  if (!hasAnyFilter && !hasExplicitSearchVerb) {
    return null;
  }

  return executeLedgerSearch(filters, transactions, contacts);
}
