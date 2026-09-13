/**
 * Local Natural Language Ledger & Financial Query Engine for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding spending history, rolling guardrail
 * headroom, counterparty transaction history, and hypothetical spending feasibility
 * 100% locally from client-side state without external cloud queries.
 */

import type { Contact } from "../contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "../spendGuardrails";
import { evaluateSpend, estimateUsdValue } from "../spendGuardrails";
import {
  computeUsage,
  recordsInWindow,
  nextCapacityRelease,
  formatCountdown,
} from "../guardrailForecast";
import { formatAddressTruncated } from "../autocomplete";

export interface LedgerQueryTransaction {
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: string;
  timestamp?: number;
  hash?: string;
}

export interface LedgerQueryContext {
  walletAddress?: string;
  contacts?: Contact[];
  guardrailConfig?: SpendingGuardrailConfig;
  spendingHistory?: SpendingRecord[];
  transactionHistory?: LedgerQueryTransaction[];
}

export interface LedgerQueryResult {
  handled: boolean;
  summary: string;
  details?: string[];
  queryType?:
    | "spending_total"
    | "headroom_check"
    | "hypothetical_spend"
    | "counterparty_inquiry"
    | "top_recipients"
    | "recent_tx";
}

/**
 * Format timestamp into human-readable relative time (e.g., "2 hours ago", "Yesterday", "3 days ago").
 */
function formatRelativeTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return "Never";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 30)} month(s) ago`;
}

/**
 * Parses and evaluates natural language financial inquiries against local state.
 */
export function evaluateLedgerQuery(
  input: string,
  context: LedgerQueryContext
): LedgerQueryResult | null {
  const clean = input.trim().toLowerCase();
  const {
    contacts = [],
    guardrailConfig,
    spendingHistory = [],
    transactionHistory = [],
  } = context;

  // 1. Hypothetical spend check: "will sending 500 usdg break my limit" or "can i send 2 eth"
  const hypotheticalMatch = clean.match(
    /(?:can\s+i\s+send|will\s+sending|is\s+it\s+safe\s+to\s+send|if\s+i\s+send)\s+([\d.]+)\s*(usdg|eth)/i
  );
  if (hypotheticalMatch && guardrailConfig) {
    const amountStr = hypotheticalMatch[1];
    const assetStr = hypotheticalMatch[2].toUpperCase() as "ETH" | "USDG";
    const amountUsd = estimateUsdValue(amountStr, assetStr);

    const verdict = evaluateSpend(guardrailConfig, amountUsd, spendingHistory);
    const usage = computeUsage(guardrailConfig, spendingHistory);

    if (verdict.allowed) {
      return {
        handled: true,
        queryType: "hypothetical_spend",
        summary: `Yes, sending ${amountStr} ${assetStr} (~$${amountUsd.toFixed(2)} USD) is within your spending limits.`,
        details: [
          `Single Transfer Cap: $${guardrailConfig.singleTxLimitUsd.toFixed(2)} USD`,
          `Current 24h Spend: $${usage.usedUsd.toFixed(2)} USD`,
          `Remaining 24h Headroom: $${usage.remainingUsd.toFixed(2)} USD`,
          `Projected Headroom After: $${Math.max(0, usage.remainingUsd - amountUsd).toFixed(2)} USD`,
        ],
      };
    } else {
      const nextRelease = nextCapacityRelease(spendingHistory);
      const nextStr = nextRelease
        ? `Capacity will start replenishing in ${formatCountdown(nextRelease.inMs)}.`
        : "Reduce the transfer amount to stay within limits.";

      return {
        handled: true,
        queryType: "hypothetical_spend",
        summary: `Warning: Sending ${amountStr} ${assetStr} (~$${amountUsd.toFixed(2)} USD) would breach your spending guardrails.`,
        details: [
          verdict.message,
          `Single Transfer Limit: $${guardrailConfig.singleTxLimitUsd.toFixed(2)} USD`,
          `24h Daily Cap: $${guardrailConfig.dailyLimitUsd.toFixed(2)} USD`,
          `Current 24h Spend: $${usage.usedUsd.toFixed(2)} USD`,
          `Remaining Headroom: $${usage.remainingUsd.toFixed(2)} USD`,
          nextStr,
        ],
      };
    }
  }

  // 2. Spending Headroom / Remaining Budget: "how much can i spend", "how much limit left", "spending headroom"
  if (
    /(how\s+much\s+(can\s+i\s+spend|do\s+i\s+have\s+left|budget\s+left|limit\s+left|headroom)|remaining\s+(budget|headroom|limit)|headroom)/i.test(
      clean
    )
  ) {
    if (!guardrailConfig || !guardrailConfig.enabled) {
      return {
        handled: true,
        queryType: "headroom_check",
        summary: "In-app spending guardrails are currently disabled. You have unlimited spending capacity on this client.",
      };
    }

    const usage = computeUsage(guardrailConfig, spendingHistory);
    const nextRelease = nextCapacityRelease(spendingHistory);

    const details = [
      `Single Transfer Cap: $${guardrailConfig.singleTxLimitUsd.toFixed(2)} USD`,
      `Daily 24h Limit: $${guardrailConfig.dailyLimitUsd.toFixed(2)} USD`,
      `Spent in Past 24h: $${usage.usedUsd.toFixed(2)} USD`,
      `Remaining Headroom: $${usage.remainingUsd.toFixed(2)} USD`,
    ];

    if (nextRelease) {
      details.push(
        `Next Capacity Replenishment: +$${nextRelease.amountUsd.toFixed(2)} USD in ${formatCountdown(nextRelease.inMs)}`
      );
    }

    return {
      handled: true,
      queryType: "headroom_check",
      summary: `You have $${usage.remainingUsd.toFixed(2)} USD remaining in your 24-hour spending budget.`,
      details,
    };
  }

  // 3. Past 24h Spending / Total spent: "how much did i spend", "how much have i spent", "total spent"
  if (
    /(how\s+much\s+(have\s+i|did\s+i)\s+spend|what\s+did\s+i\s+spend|total\s+spend|spending\s+history)/i.test(
      clean
    )
  ) {
    const inWindow = recordsInWindow(spendingHistory);
    const rollingSpent = inWindow.reduce((sum, r) => sum + (r.amountUsd || 0), 0);

    if (inWindow.length === 0) {
      return {
        handled: true,
        queryType: "spending_total",
        summary: "You have spent $0.00 USD across the last 24 hours. Your full daily budget is available.",
      };
    }

    const details = inWindow.slice(0, 5).map((r) => {
      const recipientStr = r.recipient ? formatAddressTruncated(r.recipient) : "Vault";
      return `${r.amount} ${r.symbol || "USD"} to ${recipientStr} (${formatRelativeTime(r.timestamp)})`;
    });

    return {
      handled: true,
      queryType: "spending_total",
      summary: `You have spent $${rollingSpent.toFixed(2)} USD across ${inWindow.length} transfer(s) in the last 24 hours.`,
      details,
    };
  }

  // 4. Counterparty lookup: "when did i last send to alice", "did i pay bob", "history with 0x..."
  const counterpartyMatch = clean.match(
    /(?:when\s+did\s+i\s+(?:last\s+)?(?:send|pay)(?:\s+to)?|have\s+i\s+paid|did\s+i\s+send\s+(?:to\s+)?|transactions?\s+with)\s+([a-zA-Z0-9_\-.:]+)/i
  );
  if (counterpartyMatch) {
    const targetQuery = counterpartyMatch[1].trim().toLowerCase();

    // Check if targetQuery matches a contact name or address
    const matchedContact = contacts.find(
      (c) =>
        c.name.toLowerCase().includes(targetQuery) ||
        c.address.toLowerCase().includes(targetQuery)
    );

    const targetAddress = matchedContact
      ? matchedContact.address.toLowerCase()
      : targetQuery;

    const matchedTxs = transactionHistory.filter(
      (t) =>
        t.counterparty.toLowerCase() === targetAddress ||
        (matchedContact && t.counterparty.toLowerCase() === matchedContact.address.toLowerCase())
    );

    if (matchedTxs.length === 0) {
      const displayName = matchedContact ? matchedContact.name : formatAddressTruncated(targetAddress);
      return {
        handled: true,
        queryType: "counterparty_inquiry",
        summary: `No past transactions found with ${displayName} in your local ledger.`,
      };
    }

    const sorted = [...matchedTxs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const latest = sorted[0];
    const displayName = matchedContact ? matchedContact.name : formatAddressTruncated(latest.counterparty);

    return {
      handled: true,
      queryType: "counterparty_inquiry",
      summary: `You have transacted with ${displayName} ${matchedTxs.length} time(s). Most recent: ${latest.type.toUpperCase()} ${latest.amount} ${latest.asset} (${formatRelativeTime(latest.timestamp || 0)}).`,
      details: sorted.slice(0, 5).map((t) => {
        return `${t.type === "send" ? "Sent" : "Received"} ${t.amount} ${t.asset} on ${formatRelativeTime(t.timestamp || 0)}`;
      }),
    };
  }

  // 5. Most frequent / top recipients: "who are my top recipients", "most frequent recipients", "who do i send to most"
  if (
    /(top\s+(recipients|contacts|counterparties)|most\s+frequent\s+(recipients|contacts)|who\s+do\s+i\s+send\s+to\s+most)/i.test(
      clean
    )
  ) {
    const sendTxs = transactionHistory.filter((t) => t.type === "send");
    if (sendTxs.length === 0) {
      return {
        handled: true,
        queryType: "top_recipients",
        summary: "No outbound transfer history recorded yet on this wallet.",
      };
    }

    const freqMap = new Map<string, { count: number; totalAmount: number; asset: string }>();
    for (const tx of sendTxs) {
      const cp = tx.counterparty.toLowerCase();
      const existing = freqMap.get(cp) || { count: 0, totalAmount: 0, asset: tx.asset };
      existing.count += 1;
      existing.totalAmount += parseFloat(tx.amount) || 0;
      freqMap.set(cp, existing);
    }

    const sortedRecipients = Array.from(freqMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const details = sortedRecipients.map(([addr, data]) => {
      const contact = contacts.find((c) => c.address.toLowerCase() === addr);
      const nameStr = contact ? contact.name : formatAddressTruncated(addr);
      return `${nameStr}: ${data.count} transaction(s)`;
    });

    return {
      handled: true,
      queryType: "top_recipients",
      summary: `Your top recipient is ${sortedRecipients[0] ? (contacts.find((c) => c.address.toLowerCase() === sortedRecipients[0][0])?.name || formatAddressTruncated(sortedRecipients[0][0])) : "none"}.`,
      details,
    };
  }

  // 6. Recent / Last transaction query: "what was my last transaction", "latest transfer"
  if (/(last|latest|recent)\s+(transaction|transfer|payment)/i.test(clean)) {
    if (transactionHistory.length === 0) {
      return {
        handled: true,
        queryType: "recent_tx",
        summary: "No recorded transactions found in local storage.",
      };
    }

    const sorted = [...transactionHistory].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
    const last = sorted[0];
    const contact = contacts.find(
      (c) => c.address.toLowerCase() === last.counterparty.toLowerCase()
    );
    const nameStr = contact ? contact.name : formatAddressTruncated(last.counterparty);

    return {
      handled: true,
      queryType: "recent_tx",
      summary: `Your latest transaction was ${last.type === "send" ? "sent to" : "received from"} ${nameStr}: ${last.amount} ${last.asset} (${formatRelativeTime(last.timestamp || 0)}).`,
      details: [
        `Counterparty: ${last.counterparty}`,
        `Type: ${last.type.toUpperCase()}`,
        `Amount: ${last.amount} ${last.asset}`,
        last.hash ? `Transaction Hash: ${formatAddressTruncated(last.hash, 10, 8)}` : "",
      ].filter(Boolean),
    };
  }

  return null;
}
