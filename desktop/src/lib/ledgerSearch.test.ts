import { describe, it, expect } from "vitest";
import {
  parseLedgerSearchFilters,
  executeLedgerSearch,
  type LedgerSearchTransaction,
} from "./ledgerSearch";
import { evaluateLedgerSearchQuery } from "./assistant/ledgerSearchQueries";
import type { Contact } from "./contacts";

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return NOW - days * DAY;
}

const CONTACTS: Contact[] = [
  {
    name: "Alice Partner",
    address: "0x1111111111111111111111111111111111111111",
    category: "Trusted",
    isFavorite: true,
    addedAt: daysAgo(50),
  },
  {
    name: "Bob Contractor",
    address: "0x2222222222222222222222222222222222222222",
    category: "Vendor",
    addedAt: daysAgo(30),
  },
];

const TRANSACTIONS: LedgerSearchTransaction[] = [
  {
    type: "send",
    counterparty: "0x1111111111111111111111111111111111111111",
    amount: "250",
    asset: "USDG",
    tag: "Payroll",
    timestamp: daysAgo(2),
  },
  {
    type: "send",
    counterparty: "0x1111111111111111111111111111111111111111",
    amount: "75",
    asset: "USDG",
    tag: "Payroll",
    timestamp: daysAgo(10),
  },
  {
    type: "send",
    counterparty: "0x2222222222222222222222222222222222222222",
    amount: "500",
    asset: "USDG",
    tag: "Vendor",
    timestamp: daysAgo(5),
  },
  {
    type: "send",
    counterparty: "0x3333333333333333333333333333333333333333",
    amount: "2.5",
    asset: "ETH",
    tag: "Tax Deductible",
    timestamp: daysAgo(20),
  },
  {
    type: "receive",
    counterparty: "0x4444444444444444444444444444444444444444",
    amount: "1000",
    asset: "USDG",
    tag: "Treasury",
    timestamp: daysAgo(1),
  },
];

describe("parseLedgerSearchFilters", () => {
  it("extracts cost-center tags accurately", () => {
    const f1 = parseLedgerSearchFilters("Show me all Payroll transactions", CONTACTS);
    expect(f1.tag).toBe("Payroll");

    const f2 = parseLedgerSearchFilters("Find all vendor expenses", CONTACTS);
    expect(f2.tag).toBe("Vendor");

    const f3 = parseLedgerSearchFilters("List all tax deductible payments", CONTACTS);
    expect(f3.tag).toBe("Tax Deductible");
  });

  it("extracts counterparty contact name and address", () => {
    const f = parseLedgerSearchFilters("Transfers to Alice Partner this month", CONTACTS);
    expect(f.counterparty).toBe("0x1111111111111111111111111111111111111111");
    expect(f.counterpartyName).toBe("Alice Partner");
  });

  it("extracts amount limits and asset types", () => {
    const f1 = parseLedgerSearchFilters("Payments over 100 USDG", CONTACTS);
    expect(f1.minAmount).toBe(100);
    expect(f1.asset).toBe("USDG");

    const f2 = parseLedgerSearchFilters("Transfers under 10 ETH", CONTACTS);
    expect(f2.maxAmount).toBe(10);
    expect(f2.asset).toBe("ETH");

    const f3 = parseLedgerSearchFilters("Transactions between 50 and 300 USDG", CONTACTS);
    expect(f3.minAmount).toBe(50);
    expect(f3.maxAmount).toBe(300);
  });

  it("extracts timeframes (today, this week, this month)", () => {
    const f1 = parseLedgerSearchFilters("Transactions today", CONTACTS);
    expect(f1.timeframe).toBe("Today");

    const f2 = parseLedgerSearchFilters("Payroll transfers this week", CONTACTS);
    expect(f2.timeframe).toBe("This Week");

    const f3 = parseLedgerSearchFilters("Vendor payments this month", CONTACTS);
    expect(f3.timeframe).toBe("This Month");
  });
});

describe("executeLedgerSearch", () => {
  it("filters transactions by tag", () => {
    const res = executeLedgerSearch({ tag: "Payroll" }, TRANSACTIONS, CONTACTS);
    expect(res.matchCount).toBe(2);
    expect(res.matches.every((m) => m.tag === "Payroll")).toBe(true);
    expect(res.totalVolumeByAsset["USDG"]).toBe(325); // 250 + 75
  });

  it("filters transactions by multi-criteria (tag + minAmount)", () => {
    const res = executeLedgerSearch(
      { tag: "Payroll", minAmount: 100 },
      TRANSACTIONS,
      CONTACTS
    );
    expect(res.matchCount).toBe(1);
    expect(res.matches[0].amount).toBe("250");
  });

  it("filters transactions by counterparty contact", () => {
    const res = executeLedgerSearch(
      { counterparty: "0x2222222222222222222222222222222222222222" },
      TRANSACTIONS,
      CONTACTS
    );
    expect(res.matchCount).toBe(1);
    expect(res.matches[0].counterpartyName).toBe("Bob Contractor");
    expect(res.matches[0].tag).toBe("Vendor");
  });

  it("filters transactions by direction", () => {
    const sendRes = executeLedgerSearch({ direction: "send" }, TRANSACTIONS, CONTACTS);
    expect(sendRes.matchCount).toBe(4);

    const receiveRes = executeLedgerSearch({ direction: "receive" }, TRANSACTIONS, CONTACTS);
    expect(receiveRes.matchCount).toBe(1);
    expect(receiveRes.matches[0].tag).toBe("Treasury");
  });

  it("returns zero matches cleanly when criteria does not match", () => {
    const res = executeLedgerSearch({ tag: "Personal" }, TRANSACTIONS, CONTACTS);
    expect(res.matchCount).toBe(0);
    expect(res.summary).toContain("0 matching transactions found");
  });
});

describe("evaluateLedgerSearchQuery NLP Evaluator", () => {
  it("evaluates 'Show me all Payroll transactions to Alice'", () => {
    const res = evaluateLedgerSearchQuery(
      "Show me all Payroll transactions to Alice Partner",
      { transactionHistory: TRANSACTIONS, contacts: CONTACTS }
    );
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.matchCount).toBe(2);
    expect(res?.intent.type).toBe("ledger_search");
  });

  it("evaluates 'All Vendor payments over 100 USDG'", () => {
    const res = evaluateLedgerSearchQuery(
      "All Vendor payments over 100 USDG",
      { transactionHistory: TRANSACTIONS, contacts: CONTACTS }
    );
    expect(res).not.toBeNull();
    expect(res?.matchCount).toBe(1);
    expect(res?.matches[0].amount).toBe("500");
  });

  it("evaluates 'Find tax deductible expenses'", () => {
    const res = evaluateLedgerSearchQuery(
      "Find tax deductible expenses",
      { transactionHistory: TRANSACTIONS, contacts: CONTACTS }
    );
    expect(res).not.toBeNull();
    expect(res?.matchCount).toBe(1);
    expect(res?.matches[0].asset).toBe("ETH");
  });

  it("returns null for non-search general greetings or transfers", () => {
    const res1 = evaluateLedgerSearchQuery("Send 10 USDG to Alice", {
      transactionHistory: TRANSACTIONS,
      contacts: CONTACTS,
    });
    expect(res1).toBeNull();

    const res2 = evaluateLedgerSearchQuery("hello there", {
      transactionHistory: TRANSACTIONS,
      contacts: CONTACTS,
    });
    expect(res2).toBeNull();
  });

  it("evaluates 'What did I send in September?' - regression", () => {
    const res = evaluateLedgerSearchQuery(
      "What did I send in September?",
      { transactionHistory: TRANSACTIONS, contacts: CONTACTS }
    );
    expect(res).not.toBeNull();
    expect(res?.intent.type).toBe("ledger_search");
    expect((res?.intent as { filters?: { direction?: string } }).filters?.direction).toBe("send");
  });

  it("evaluates 'Find outgoing transfers to Alice' - regression", () => {
    const res = evaluateLedgerSearchQuery(
      "Find outgoing transfers to Alice",
      { transactionHistory: TRANSACTIONS, contacts: CONTACTS }
    );
    expect(res).not.toBeNull();
    expect(res?.intent.type).toBe("ledger_search");
    expect((res?.intent as { filters?: { direction?: string } }).filters?.direction).toBe("send");
  });
});
