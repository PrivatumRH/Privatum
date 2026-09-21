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

  // 1. "what did I send/receive/pay/transfer..." - conversational recall
  const hasConversationalRecall =
    /^what\s+(?:did\s+i|have\s+i)\s+(?:sent?|received?|paid?|transferred?)/i.test(lower) ||
    /^what\s+(?:transactions?|transfers?|payments?|sends?)\s+(?:did\s+i|have\s+i)/i.test(lower) ||
    /^(?:did\s+i\s+(?:send|pay|transfer)(?:\s+anything)?)\s+to\b/i.test(lower);

  // 2. Explicit search verbs - allow optional modifiers (outgoing, incoming, etc.) between verb and noun
  const hasExplicitSearchVerb =
    /^(?:find|search|filter|show|list|recall|get|display)\s+(?:all\s+)?(?:the\s+)?(?:my\s+)?(?:outgoing\s+|incoming\s+|sent\s+|received\s+)?(?:transactions?|transfers?|payments?|records?|history|ledger|txs?|expenses?|sends?)\b/i.test(
      lower
    ) ||
    /^(?:find|search|filter|show|list|recall|get|display)\s+(?:outgoing|incoming|sent|received)\s+(?:transfers?|payments?|transactions?)/i.test(
      lower
    ) ||
    /\b(?:search\s+(?:my\s+)?ledger|find\s+(?:in\s+)?(?:my\s+)?ledger|ledger\s+search|search\s+(?:my\s+)?transactions?)\b/i.test(
      lower
    );

  // 3. "show me what I sent/received/paid to X"
  const hasShowMeRecall =
    /^show\s+(?:me\s+)?(?:what|all|my)?\s*(?:i\s+)?(?:sent?|paid?|received?|transferred?)/i.test(
      lower
    );

  // 4. Tag-specific queries ("all payroll transactions", "vendor expenses", "tax deductible payments")
  const tagMentioned = TRANSACTION_TAGS.find((t) => lower.includes(t.toLowerCase()));
  const hasTagQuery =
    Boolean(tagMentioned) &&
    /\b(?:transactions?|payments?|transfers?|records?|expenses?|spend(?:ing)?|costs?)\b/i.test(
      lower
    ) &&
    !lower.includes("what is my spending breakdown") &&
    !lower.includes("spending breakdown by tag");

  // 5. Amount-bounded queries ("payments over 100 usdg", "transfers under 50", "transactions between 20 and 50")
  const hasAmountBoundQuery =
    /\b(?:transactions?|transfers?|payments?|sends?)\s+(?:over|greater than|above|under|less than|below|between)\s+[\d.]+/i.test(
      lower
    ) ||
    /\b(?:all\s+)?(?:payments?|transfers?)\s+(?:over|under|between)\s+[\d.]+/i.test(lower);

  // 6. Timeframe-bounded queries
  // "transactions in september", "what did I send this week", "payments in august"
  const hasTimeframeBound =
    /\b(?:transactions?|transfers?|payments?|sends?|sent)\s+(?:in|during)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      lower
    ) ||
    /\bwhat\s+(?:did\s+i|have\s+i)\s+(?:sent?|paid?|received?|transferred?)\s+(?:in|during|this|last)\b/i.test(
      lower
    ) ||
    /\b(?:in|during)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      lower
    ) && /\b(?:send|sent|pay|paid|receive|received|transfer|transferred)\b/i.test(lower);

  // 7. "transfers to/from X", "payments to/from X" standalone phrases
  const hasCounterpartyDirectQuery =
    /^(?:transfers?|payments?|transactions?)\s+(?:to|from|with)\s+[a-zA-Z0-9_\- ]+/i.test(
      lower
    ) ||
    /^(?:find|show|list)\s+(?:outgoing|incoming|all)?\s*(?:transfers?|payments?)\s+to\s+[a-zA-Z0-9_\- ]+/i.test(
      lower
    ) ||
    /^(?:find|search)\s+(?:for\s+)?(?:transfers?|payments?|transactions?)\s+(?:for|to|from|with)\s+[a-zA-Z0-9_\- ]+/i.test(
      lower
    );

  if (
    !hasConversationalRecall &&
    !hasExplicitSearchVerb &&
    !hasShowMeRecall &&
    !hasTagQuery &&
    !hasAmountBoundQuery &&
    !hasTimeframeBound &&
    !hasCounterpartyDirectQuery
  ) {
    return null;
  }

  // Parse filters from the natural language query
  const filters = parseLedgerSearchFilters(clean, contacts);

  // Avoid false positives: if zero meaningful filters were extracted, bail out
  const hasAnyFilter =
    Boolean(filters.tag) ||
    Boolean(filters.counterparty) ||
    Boolean(filters.counterpartyName) ||
    Boolean(filters.asset) ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined ||
    filters.startTimestamp !== undefined ||
    (filters.direction && filters.direction !== "all");

  if (!hasAnyFilter && !hasExplicitSearchVerb && !hasTagQuery) {
    return null;
  }

  return executeLedgerSearch(filters, transactions, contacts);
}
