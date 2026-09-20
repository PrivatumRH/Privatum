import { describe, it, expect } from "vitest";
import {
  getTopCounterparties,
  getSpendingByTag,
  getVelocity,
  getCounterpartyDetail,
  runSpendingAnalytics,
  type AnalyticsTransaction,
} from "./spendingAnalytics";
import type { ParsedSpendingAnalyticsIntent } from "./assistant/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): number {
  return NOW - n * DAY;
}

const TRANSACTIONS: AnalyticsTransaction[] = [
  // Sends to Alice - Payroll
  {
    type: "send",
    counterparty: "0xAlice000000000000000000000000000000000001",
    amount: "100",
    asset: "USDG",
    tag: "Payroll",
    timestamp: daysAgo(2),
  },
  {
    type: "send",
    counterparty: "0xAlice000000000000000000000000000000000001",
    amount: "50",
    asset: "USDG",
    tag: "Payroll",
    timestamp: daysAgo(5),
  },
  // Send to Bob - Vendor
  {
    type: "send",
    counterparty: "0xBob0000000000000000000000000000000000002",
    amount: "200",
    asset: "USDG",
    tag: "Vendor",
    timestamp: daysAgo(3),
  },
  // Send to Carol - Tax Deductible, 45 days ago (outside week/month window)
  {
    type: "send",
    counterparty: "0xCarol00000000000000000000000000000000003",
    amount: "500",
    asset: "ETH",
    tag: "Tax Deductible",
    timestamp: daysAgo(45),
  },
  // Receive from Dave - should not count as outgoing
  {
    type: "receive",
    counterparty: "0xDave000000000000000000000000000000000004",
    amount: "999",
    asset: "USDG",
    timestamp: daysAgo(1),
  },
  // Send to Eve - Operations, no timestamp
  {
    type: "send",
    counterparty: "Eve Corp",
    amount: "75",
    asset: "USDG",
    tag: "Operations",
  },
];

// ---------------------------------------------------------------------------
// getTopCounterparties
// ---------------------------------------------------------------------------

describe("getTopCounterparties", () => {
  it("ranks outgoing counterparties by volume descending", () => {
    const results = getTopCounterparties(TRANSACTIONS, 5);
    // Carol sent the most ETH (500 ETH equivalent), but primary asset is USDG for Alice+Bob
    // Bob: 200 USDG, Alice: 150 USDG, Eve: 75 USDG, Carol: 500 ETH
    // Results should be sorted per primary asset; let's just verify Bob > Alice for USDG
    const usdgResults = results.filter((r) => r.asset === "USDG");
    expect(usdgResults[0].total).toBeGreaterThanOrEqual(usdgResults[1]?.total ?? 0);
  });

  it("excludes receive transactions", () => {
    const results = getTopCounterparties(TRANSACTIONS, 10);
    const counterparties = results.map((r) => r.counterparty.toLowerCase());
    expect(counterparties).not.toContain("0xdave000000000000000000000000000000000004");
  });

  it("respects the week timeframe filter", () => {
    // Carol's tx is 45 days ago, should be excluded from weekly view
    const results = getTopCounterparties(TRANSACTIONS, 10, "week");
    const counterparties = results.map((r) => r.counterparty.toLowerCase());
    expect(counterparties).not.toContain("0xcarol00000000000000000000000000000000003");
  });

  it("respects the month timeframe filter", () => {
    const results = getTopCounterparties(TRANSACTIONS, 10, "month");
    const counterparties = results.map((r) => r.counterparty.toLowerCase());
    // Carol (45 days ago) should be excluded from 30-day window
    expect(counterparties).not.toContain("0xcarol00000000000000000000000000000000003");
  });

  it("limits results to the requested count", () => {
    const results = getTopCounterparties(TRANSACTIONS, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("excludes transactions with no timestamp when timeframe is set", () => {
    // Eve Corp has no timestamp, so it should not appear in time-filtered results
    const results = getTopCounterparties(TRANSACTIONS, 10, "week");
    const counterparties = results.map((r) => r.counterparty.toLowerCase());
    expect(counterparties).not.toContain("eve corp");
  });

  it("returns correct txCount for Alice", () => {
    const results = getTopCounterparties(TRANSACTIONS, 10);
    const alice = results.find((r) =>
      r.counterparty.includes("Alice") || r.counterparty.includes("alice")
    );
    expect(alice?.txCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getSpendingByTag
// ---------------------------------------------------------------------------

describe("getSpendingByTag", () => {
  it("groups outgoing transactions by tag", () => {
    const results = getSpendingByTag(TRANSACTIONS);
    const tags = results.map((r) => r.tag);
    expect(tags).toContain("Payroll");
    expect(tags).toContain("Vendor");
    expect(tags).toContain("Tax Deductible");
    expect(tags).toContain("Operations");
  });

  it("sums payroll amounts correctly", () => {
    const results = getSpendingByTag(TRANSACTIONS);
    const payroll = results.find((r) => r.tag === "Payroll");
    expect(payroll?.total).toBe(150); // 100 + 50
    expect(payroll?.txCount).toBe(2);
  });

  it("sums vendor amounts correctly", () => {
    const results = getSpendingByTag(TRANSACTIONS);
    const vendor = results.find((r) => r.tag === "Vendor");
    expect(vendor?.total).toBe(200);
    expect(vendor?.txCount).toBe(1);
  });

  it("excludes receive transactions from tag breakdown", () => {
    const results = getSpendingByTag(TRANSACTIONS);
    const total = results.reduce((s, r) => s + r.txCount, 0);
    // 5 sends (Alice x2, Bob, Carol, Eve) not the receive from Dave
    expect(total).toBe(5);
  });

  it("respects week timeframe - excludes Carol (45 days ago)", () => {
    const results = getSpendingByTag(TRANSACTIONS, "week");
    const tags = results.map((r) => r.tag);
    expect(tags).not.toContain("Tax Deductible");
  });

  it("sorts tags by total descending", () => {
    const results = getSpendingByTag(TRANSACTIONS);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].total).toBeGreaterThanOrEqual(results[i].total);
    }
  });
});

// ---------------------------------------------------------------------------
// getVelocity
// ---------------------------------------------------------------------------

describe("getVelocity", () => {
  it("counts only sends within the rolling window", () => {
    const vel = getVelocity(TRANSACTIONS, 7);
    // Within last 7 days: Alice x2 (days 2,5), Bob (day 3), Eve has no timestamp
    // Carol is at day 45 - outside window
    expect(vel.txCount).toBe(3);
  });

  it("computes correct total for 7-day window", () => {
    const vel = getVelocity(TRANSACTIONS, 7);
    // Alice: 100+50=150, Bob: 200, total USDG = 350
    expect(vel.totalByAsset["USDG"]).toBe(350);
  });

  it("returns chart data with correct number of days", () => {
    const vel = getVelocity(TRANSACTIONS, 7);
    expect(vel.chartData.length).toBe(7);
  });

  it("computes correct daily average", () => {
    const vel = getVelocity(TRANSACTIONS, 7);
    expect(vel.dailyAvgByAsset["USDG"]).toBeCloseTo(350 / 7, 4);
  });

  it("returns zero txCount when no timestamped sends exist in window", () => {
    const onlyUntimed: AnalyticsTransaction[] = [
      { type: "send", counterparty: "X", amount: "10", asset: "USDG" },
    ];
    const vel = getVelocity(onlyUntimed, 7);
    expect(vel.txCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCounterpartyDetail
// ---------------------------------------------------------------------------

describe("getCounterpartyDetail", () => {
  it("returns detail for a matched counterparty substring", () => {
    const detail = getCounterpartyDetail(TRANSACTIONS, "alice");
    expect(detail).not.toBeNull();
    expect(detail?.txCount).toBe(2);
    expect(detail?.totalByAsset["USDG"]).toBe(150);
  });

  it("returns null for an unknown counterparty", () => {
    const detail = getCounterpartyDetail(TRANSACTIONS, "0xnonexistent");
    expect(detail).toBeNull();
  });

  it("returns correct tags for counterparty", () => {
    const detail = getCounterpartyDetail(TRANSACTIONS, "alice");
    expect(detail?.tags).toContain("Payroll");
  });

  it("respects timeframe filter for counterparty detail", () => {
    // Carol's tx is 45 days ago - week filter should yield null
    const detail = getCounterpartyDetail(TRANSACTIONS, "carol", "week");
    expect(detail).toBeNull();
  });

  it("provides firstSeen and lastSeen timestamps", () => {
    const detail = getCounterpartyDetail(TRANSACTIONS, "alice");
    expect(detail?.firstSeen).toBeDefined();
    expect(detail?.lastSeen).toBeDefined();
    expect(detail!.lastSeen!).toBeGreaterThan(detail!.firstSeen!);
  });
});

// ---------------------------------------------------------------------------
// runSpendingAnalytics (dispatcher)
// ---------------------------------------------------------------------------

describe("runSpendingAnalytics", () => {
  const baseIntent = (
    subtype: ParsedSpendingAnalyticsIntent["subtype"],
    extra?: Partial<ParsedSpendingAnalyticsIntent>
  ): ParsedSpendingAnalyticsIntent => ({
    type: "spending_analytics",
    subtype,
    summary: "",
    details: [],
    ...extra,
  });

  it("handles top_counterparties", () => {
    const res = runSpendingAnalytics(baseIntent("top_counterparties"), TRANSACTIONS);
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/Top/i);
    expect(res.chartData).toBeDefined();
    expect(res.chartData!.length).toBeGreaterThan(0);
  });

  it("handles tag_breakdown", () => {
    const res = runSpendingAnalytics(baseIntent("tag_breakdown"), TRANSACTIONS);
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/breakdown/i);
    expect(res.details?.some((d) => d.includes("Payroll"))).toBe(true);
  });

  it("handles velocity - week", () => {
    const res = runSpendingAnalytics(
      baseIntent("velocity", { timeframe: "week" }),
      TRANSACTIONS
    );
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/7-day/i);
    expect(res.chartData?.length).toBe(7);
  });

  it("handles counterparty_detail - found", () => {
    const res = runSpendingAnalytics(
      baseIntent("counterparty_detail", { counterparty: "alice" }),
      TRANSACTIONS
    );
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/150/);
  });

  it("handles counterparty_detail - not found", () => {
    const res = runSpendingAnalytics(
      baseIntent("counterparty_detail", { counterparty: "zeus" }),
      TRANSACTIONS
    );
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/no outgoing/i);
  });

  it("returns handled result with empty tx list for top_counterparties", () => {
    const res = runSpendingAnalytics(baseIntent("top_counterparties"), []);
    expect(res.handled).toBe(true);
    expect(res.summary).toMatch(/no outgoing/i);
  });
});
