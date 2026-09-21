/**
 * Multi-Criteria Ledger Search & Recall Engine for PRIVATUM Assistant.
 *
 * Provides conversational ledger query resolution across tags, counterparties,
 * amounts, assets, and timeframe filters.
 *
 * 100% client-side and deterministic: executes in device memory with zero external telemetry.
 */

import type { Contact } from "./contacts";
import { TRANSACTION_TAGS, type TransactionTag } from "./transactionTags";
import type { ParsedLedgerSearchIntent } from "./assistant/types";

export interface LedgerSearchTransaction {
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: string;
  timestamp?: number;
  hash?: string;
  tag?: string;
}

export interface LedgerSearchFilters {
  tag?: string;
  counterparty?: string;
  counterpartyName?: string;
  direction?: "send" | "receive" | "all";
  minAmount?: number;
  maxAmount?: number;
  asset?: string;
  timeframe?: string;
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface LedgerSearchResult {
  handled: true;
  summary: string;
  details: string[];
  filters: LedgerSearchFilters;
  matchCount: number;
  totalVolumeByAsset: Record<string, number>;
  matches: {
    type: "send" | "receive";
    counterparty: string;
    counterpartyName?: string;
    amount: string;
    asset: string;
    timestamp?: number;
    tag?: string;
    hash?: string;
  }[];
  intent: ParsedLedgerSearchIntent;
}

/**
 * Parses numeric amount cleanly.
 */
function parseAmount(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Shortens an address for clean display.
 */
function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Extracts month start and end timestamps if a month name is mentioned.
 */
function extractMonthWindow(text: string): { start: number; end: number; label: string } | null {
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const shortMonths = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "sept",
    "oct",
    "nov",
    "dec",
  ];

  const lower = text.toLowerCase();
  for (let i = 0; i < months.length; i++) {
    const full = months[i];
    const short = shortMonths[i];
    const regex = new RegExp(`\\b(?:in|during|for)?\\s*(?:${full}|${short})\\b`, "i");
    if (regex.test(lower)) {
      const now = new Date();
      const year = now.getFullYear();
      const startDate = new Date(year, i, 1, 0, 0, 0, 0);
      const endDate = new Date(year, i + 1, 0, 23, 59, 59, 999);
      return {
        start: startDate.getTime(),
        end: endDate.getTime(),
        label: full.charAt(0).toUpperCase() + full.slice(1),
      };
    }
  }
  return null;
}

/**
 * Parses conversational natural language into structured search filters.
 */
export function parseLedgerSearchFilters(
  input: string,
  contacts: Contact[] = []
): LedgerSearchFilters {
  const lower = input.toLowerCase();
  const filters: LedgerSearchFilters = {};

  // 1. Tag / Cost-Center extraction
  for (const tag of TRANSACTION_TAGS) {
    const tagLower = tag.toLowerCase();
    if (lower.includes(tagLower)) {
      filters.tag = tag;
      break;
    }
  }
  if (!filters.tag) {
    if (/\b(?:tax(?:es)?|deductible)\b/i.test(lower)) {
      filters.tag = "Tax Deductible";
    } else if (/\b(?:ops)\b/i.test(lower)) {
      filters.tag = "Operations";
    }
  }

  // 2. Counterparty / Contact resolution
  // Check raw 0x hex addresses first
  const hexMatch = input.match(/0x[a-fA-F0-9]{40}/);
  if (hexMatch) {
    const addr = hexMatch[0].toLowerCase();
    filters.counterparty = addr;
    const foundContact = contacts.find((c) => c.address.toLowerCase() === addr);
    if (foundContact) {
      filters.counterpartyName = foundContact.name;
    }
  } else {
    // Check known contacts by name
    for (const contact of contacts) {
      if (contact.name && lower.includes(contact.name.toLowerCase())) {
        filters.counterparty = contact.address.toLowerCase();
        filters.counterpartyName = contact.name;
        break;
      }
    }

    // Check "to <name>" or "from <name>" or "with <name>" pattern
    if (!filters.counterparty) {
      const nameMatch = input.match(/(?:to|from|with|paid to|sent to)\s+([a-zA-Z0-9_\- ]+?)(?:\s+(?:in|over|under|for|with|between|this|last)|$)/i);
      if (nameMatch) {
        const candidate = nameMatch[1].trim();
        if (
          candidate &&
          !TRANSACTION_TAGS.some((t) => t.toLowerCase() === candidate.toLowerCase()) &&
          !["usdg", "eth", "usdc", "all", "the", "my"].includes(candidate.toLowerCase())
        ) {
          filters.counterpartyName = candidate;
        }
      }
    }
  }

  // 3. Direction extraction
  if (/\b(?:sent?|outgoing|paid?|transfers?\s+to|i\s+send|i\s+sent|i\s+paid?|did\s+i\s+send|did\s+i\s+pay)\b/i.test(lower)) {
    filters.direction = "send";
  } else if (/\b(?:received?|incoming|deposits?|i\s+received?|did\s+i\s+receive)\b/i.test(lower) && !lower.includes("sent from")) {
    filters.direction = "receive";
  } else {
    filters.direction = "all";
  }

  // 4. Asset extraction
  if (/\b(?:usdg)\b/i.test(lower)) {
    filters.asset = "USDG";
  } else if (/\b(?:eth|ether)\b/i.test(lower)) {
    filters.asset = "ETH";
  } else if (/\b(?:usdc)\b/i.test(lower)) {
    filters.asset = "USDC";
  } else if (/\b(?:usdt)\b/i.test(lower)) {
    filters.asset = "USDT";
  }

  // 5. Amount range extraction
  const betweenMatch = lower.match(/between\s+([\d.]+)\s*(?:and|-)\s*([\d.]+)/i);
  if (betweenMatch) {
    filters.minAmount = parseAmount(betweenMatch[1]);
    filters.maxAmount = parseAmount(betweenMatch[2]);
  } else {
    const minMatch = lower.match(/(?:over|greater than|above|more than|>|at least)\s+([\d.]+)/i);
    if (minMatch) {
      filters.minAmount = parseAmount(minMatch[1]);
    }
    const maxMatch = lower.match(/(?:under|less than|below|<|at most)\s+([\d.]+)/i);
    if (maxMatch) {
      filters.maxAmount = parseAmount(maxMatch[1]);
    }
  }

  // 6. Timeframe extraction
  const now = Date.now();
  const monthWindow = extractMonthWindow(input);
  if (monthWindow) {
    filters.startTimestamp = monthWindow.start;
    filters.endTimestamp = monthWindow.end;
    filters.timeframe = monthWindow.label;
  } else if (/\btoday\b/i.test(lower)) {
    filters.startTimestamp = now - 24 * 60 * 60 * 1000;
    filters.timeframe = "Today";
  } else if (/\bthis\s+week\b|\bpast\s+7\s*days?\b|\blast\s+7\s*days?\b/i.test(lower)) {
    filters.startTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    filters.timeframe = "This Week";
  } else if (/\bthis\s+month\b|\bpast\s+30\s*days?\b|\blast\s+30\s*days?\b/i.test(lower)) {
    filters.startTimestamp = now - 30 * 24 * 60 * 60 * 1000;
    filters.timeframe = "This Month";
  } else if (/\blast\s+month\b/i.test(lower)) {
    filters.startTimestamp = now - 60 * 24 * 60 * 60 * 1000;
    filters.endTimestamp = now - 30 * 24 * 60 * 60 * 1000;
    filters.timeframe = "Last Month";
  }

  return filters;
}

/**
 * Executes multi-criteria search over local transaction history.
 */
export function executeLedgerSearch(
  filters: LedgerSearchFilters,
  transactions: LedgerSearchTransaction[],
  contacts: Contact[] = []
): LedgerSearchResult {
  const filtered = transactions.filter((tx) => {
    // 1. Tag filter
    if (filters.tag) {
      if (!tx.tag || tx.tag.toLowerCase() !== filters.tag.toLowerCase()) {
        return false;
      }
    }

    // 2. Direction filter
    if (filters.direction && filters.direction !== "all") {
      if (tx.type !== filters.direction) {
        return false;
      }
    }

    // 3. Counterparty filter
    if (filters.counterparty) {
      if (tx.counterparty.toLowerCase() !== filters.counterparty.toLowerCase()) {
        return false;
      }
    } else if (filters.counterpartyName) {
      const q = filters.counterpartyName.toLowerCase();
      const matchedContact = contacts.find((c) => c.name.toLowerCase().includes(q));
      const matchesAddress = tx.counterparty.toLowerCase().includes(q);
      const matchesContact = matchedContact && tx.counterparty.toLowerCase() === matchedContact.address.toLowerCase();
      if (!matchesAddress && !matchesContact) {
        return false;
      }
    }

    // 4. Asset filter
    if (filters.asset) {
      if (tx.asset.toUpperCase() !== filters.asset.toUpperCase()) {
        return false;
      }
    }

    // 5. Amount filter
    const amt = parseAmount(tx.amount);
    if (filters.minAmount !== undefined && amt < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount !== undefined && amt > filters.maxAmount) {
      return false;
    }

    // 6. Timeframe filter
    if (filters.startTimestamp !== undefined) {
      if (!tx.timestamp || tx.timestamp < filters.startTimestamp) {
        return false;
      }
    }
    if (filters.endTimestamp !== undefined) {
      if (!tx.timestamp || tx.timestamp > filters.endTimestamp) {
        return false;
      }
    }

    return true;
  });

  // Sort matched transactions descending by timestamp
  const sortedMatches = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Compute aggregate volume per asset
  const totalVolumeByAsset: Record<string, number> = {};
  for (const tx of sortedMatches) {
    const a = parseAmount(tx.amount);
    totalVolumeByAsset[tx.asset] = (totalVolumeByAsset[tx.asset] || 0) + a;
  }

  // Format matches with resolved counterparty display names
  const matches = sortedMatches.map((tx) => {
    const matchedContact = contacts.find(
      (c) => c.address.toLowerCase() === tx.counterparty.toLowerCase()
    );
    return {
      type: tx.type,
      counterparty: tx.counterparty,
      counterpartyName: matchedContact ? matchedContact.name : undefined,
      amount: tx.amount,
      asset: tx.asset,
      timestamp: tx.timestamp,
      tag: tx.tag,
      hash: tx.hash,
    };
  });

  // Build filter label list for summary
  const activeFilterLabels: string[] = [];
  if (filters.tag) activeFilterLabels.push(`Tag: ${filters.tag}`);
  if (filters.counterpartyName) {
    activeFilterLabels.push(`Counterparty: ${filters.counterpartyName}`);
  } else if (filters.counterparty) {
    activeFilterLabels.push(`Counterparty: ${shortenAddr(filters.counterparty)}`);
  }
  if (filters.direction && filters.direction !== "all") {
    activeFilterLabels.push(`Type: ${filters.direction.toUpperCase()}`);
  }
  if (filters.asset) activeFilterLabels.push(`Asset: ${filters.asset}`);
  if (filters.minAmount !== undefined && filters.maxAmount !== undefined) {
    activeFilterLabels.push(`Amount: ${filters.minAmount}-${filters.maxAmount}`);
  } else if (filters.minAmount !== undefined) {
    activeFilterLabels.push(`Amount: >${filters.minAmount}`);
  } else if (filters.maxAmount !== undefined) {
    activeFilterLabels.push(`Amount: <${filters.maxAmount}`);
  }
  if (filters.timeframe) activeFilterLabels.push(`Time: ${filters.timeframe}`);

  const filterSummary = activeFilterLabels.length > 0 ? ` [${activeFilterLabels.join(", ")}]` : "";

  // Build volume summary string
  const volumeParts = Object.entries(totalVolumeByAsset).map(
    ([asset, sum]) => `${sum.toFixed(2)} ${asset}`
  );
  const volumeSummary = volumeParts.length > 0 ? ` (Total Volume: ${volumeParts.join(" + ")})` : "";

  const summary = matches.length === 0
    ? `Ledger Search: 0 matching transactions found${filterSummary}.`
    : `Ledger Search: Found ${matches.length} transaction(s)${filterSummary}${volumeSummary}.`;

  const details = matches.slice(0, 8).map((tx) => {
    const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "Undated";
    const cpStr = tx.counterpartyName || shortenAddr(tx.counterparty);
    const tagStr = tx.tag ? ` [${tx.tag}]` : "";
    return `${dateStr}: ${tx.type.toUpperCase()} ${tx.amount} ${tx.asset} to/from ${cpStr}${tagStr}`;
  });

  if (matches.length > 8) {
    details.push(`...and ${matches.length - 8} more matching transaction(s).`);
  }

  const intent: ParsedLedgerSearchIntent = {
    type: "ledger_search",
    summary,
    filters,
    matchCount: matches.length,
    totalVolumeByAsset,
    matches,
  };

  return {
    handled: true,
    summary,
    details,
    filters,
    matchCount: matches.length,
    totalVolumeByAsset,
    matches,
    intent,
  };
}
