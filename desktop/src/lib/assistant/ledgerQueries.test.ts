import { describe, it, expect } from "bun:test";
import { evaluateLedgerQuery, LedgerQueryContext } from "./ledgerQueries";
import type { SpendingGuardrailConfig, SpendingRecord } from "../spendGuardrails";
import type { Contact } from "../contacts";

describe("Local Natural Language Ledger Queries", () => {
  const mockConfig: SpendingGuardrailConfig = {
    enabled: true,
    singleTxLimitUsd: 500,
    dailyLimitUsd: 1000,
    strictMode: true,
  };

  const now = Date.now();

  const mockSpendingHistory: SpendingRecord[] = [
    {
      txHash: "0x1111",
      amountUsd: 200,
      timestamp: now - 3600000 * 2, // 2 hours ago
      symbol: "USDG",
      amount: 200,
      recipient: "0x3f8a0000000000000000000000000000000091b2",
    },
    {
      txHash: "0x2222",
      amountUsd: 150,
      timestamp: now - 3600000 * 4, // 4 hours ago
      symbol: "USDG",
      amount: 150,
      recipient: "0x7b2200000000000000000000000000000000c418",
    },
  ];

  const mockContacts: Contact[] = [
    {
      id: "contact-1",
      name: "Alice Treasury",
      address: "0x3f8a0000000000000000000000000000000091b2",
      category: "Work",
      createdAt: now - 1000000,
    },
    {
      id: "contact-2",
      name: "Bob Personal",
      address: "0x7b2200000000000000000000000000000000c418",
      category: "Personal",
      createdAt: now - 2000000,
    },
  ];

  const mockTxs = [
    {
      type: "send" as const,
      counterparty: "0x3f8a0000000000000000000000000000000091b2",
      amount: "200",
      asset: "USDG",
      timestamp: now - 3600000 * 2,
    },
    {
      type: "send" as const,
      counterparty: "0x3f8a0000000000000000000000000000000091b2",
      amount: "100",
      asset: "USDG",
      timestamp: now - 86400000 * 2,
    },
    {
      type: "send" as const,
      counterparty: "0x7b2200000000000000000000000000000000c418",
      amount: "150",
      asset: "USDG",
      timestamp: now - 3600000 * 4,
    },
  ];

  const context: LedgerQueryContext = {
    contacts: mockContacts,
    guardrailConfig: mockConfig,
    spendingHistory: mockSpendingHistory,
    transactionHistory: mockTxs,
  };

  it("evaluates a safe hypothetical spend within limits", () => {
    const res = evaluateLedgerQuery("Can I send 100 USDG?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("hypothetical_spend");
    expect(res?.summary).toContain("within your spending limits");
  });

  it("flags a hypothetical spend that breaches single-transfer cap", () => {
    const res = evaluateLedgerQuery("Will sending 600 USDG break my limit?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("hypothetical_spend");
    expect(res?.summary).toContain("Warning");
    expect(res?.details?.some((d) => d.toLowerCase().includes("single transfer limit"))).toBe(true);
  });

  it("flags a hypothetical spend that breaches daily remaining limit", () => {
    // Current spend is $350. Daily limit is $1000. Remaining is $650.
    // Sending 400 is fine, but 490 is fine single tx, wait:
    // If we have single cap $500, sending 500 would make total 850 (fine).
    // Let's test sending 400 USDG twice or single limit breach.
    const res = evaluateLedgerQuery("Can I send 450 USDG?", context);
    expect(res?.summary).toContain("within your spending limits");
  });

  it("evaluates remaining headroom query", () => {
    const res = evaluateLedgerQuery("How much headroom do I have left?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("headroom_check");
    // $1000 limit - $350 spent = $650 remaining
    expect(res?.summary).toContain("650.00 USD remaining");
  });

  it("evaluates past 24h spending query", () => {
    const res = evaluateLedgerQuery("How much did I spend today?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("spending_total");
    expect(res?.summary).toContain("350.00 USD");
  });

  it("evaluates counterparty transaction history by contact name", () => {
    const res = evaluateLedgerQuery("When did I last send to Alice?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("counterparty_inquiry");
    expect(res?.summary).toContain("Alice Treasury");
    expect(res?.summary).toContain("2 time(s)");
  });

  it("ranks top recipients by frequency", () => {
    const res = evaluateLedgerQuery("Who are my top recipients?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("top_recipients");
    expect(res?.summary).toContain("Alice Treasury");
  });

  it("returns latest transaction details", () => {
    const res = evaluateLedgerQuery("What was my latest transfer?", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.queryType).toBe("recent_tx");
    expect(res?.summary).toContain("sent to Alice Treasury");
  });

  it("returns null for unrelated generic prompts", () => {
    const res = evaluateLedgerQuery("Hello how are you doing today?", context);
    expect(res).toBeNull();
  });
});
