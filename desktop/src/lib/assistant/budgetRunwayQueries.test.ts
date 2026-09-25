import { describe, it, expect } from "vitest";
import { evaluateBudgetRunwayQuery } from "./budgetRunwayQueries";
import type { SpendingGuardrailConfig, SpendingRecord } from "../spendGuardrails";
import type { OfflineTransaction } from "../offlineOutbox";

describe("budgetRunwayQueries", () => {
  const MOCK_CONFIG: SpendingGuardrailConfig = {
    enabled: true,
    dailyLimitUsd: 1000,
    singleTxLimitUsd: 500,
    strictMode: false,
  };

  const NOW = 1700000000000;
  const ONE_HOUR = 60 * 60 * 1000;

  it("evaluates runway forecast queries", () => {
    const history: SpendingRecord[] = [
      {
        txHash: "0x1",
        timestamp: NOW - 2 * ONE_HOUR,
        amount: 200,
        symbol: "USDG",
        amountUsd: 200,
        recipient: "0xabc",
      },
    ];

    const result = evaluateBudgetRunwayQuery("Forecast my spending runway for the rest of the month", {
      guardrailConfig: MOCK_CONFIG,
      spendingHistory: history,
      now: NOW,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent.type).toBe("budget_runway");
    expect(result?.report.current24hSpentUsd).toBe(200);
    expect(result?.report.remainingHeadroomUsd).toBe(800);
    expect(result?.details.some((d) => d.includes("Remaining Headroom: $800.00"))).toBe(true);
    expect(result?.details.some((d) => d.includes("Next Rolling Reset:"))).toBe(true);
  });

  it("evaluates queued outbox breach inquiries", () => {
    const history: SpendingRecord[] = [
      {
        txHash: "0x1",
        timestamp: NOW - 1 * ONE_HOUR,
        amount: 800,
        symbol: "USDG",
        amountUsd: 800,
        recipient: "0xabc",
      },
    ];

    const outbox: OfflineTransaction[] = [
      {
        id: "tx-1",
        walletAddress: "0x111",
        nonce: 1,
        recipient: "0x222",
        amount: "300",
        asset: "USDG",
        chainId: 11155111,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0x01",
        createdAt: NOW,
        status: "queued",
      },
    ];

    const result = evaluateBudgetRunwayQuery("Will my queued batch exceed my daily limit?", {
      guardrailConfig: MOCK_CONFIG,
      spendingHistory: history,
      offlineOutbox: outbox,
      now: NOW,
    });

    expect(result).not.toBeNull();
    expect(result?.report.willQueuedExceedLimit).toBe(true);
    expect(result?.report.riskTier).toBe("critical");
    expect(result?.details.some((d) => d.includes("BREACHES LIMIT"))).toBe(true);
  });

  it("evaluates rolling reset time inquiries", () => {
    const history: SpendingRecord[] = [
      {
        txHash: "0x1",
        timestamp: NOW - 6 * ONE_HOUR,
        amount: 100,
        symbol: "USDG",
        amountUsd: 100,
        recipient: "0xabc",
      },
    ];

    const result = evaluateBudgetRunwayQuery("When will my spending limit reset?", {
      guardrailConfig: MOCK_CONFIG,
      spendingHistory: history,
      now: NOW,
    });

    expect(result).not.toBeNull();
    expect(result?.report.resetWindow.formattedTimeUntilReset).toBe("18h 0m");
    expect(result?.details.some((d) => d.includes("Next Rolling Reset: 18h 0m"))).toBe(true);
  });

  it("returns null for unrelated prompts", () => {
    expect(evaluateBudgetRunwayQuery("hello assistant")).toBeNull();
    expect(evaluateBudgetRunwayQuery("what is my address?")).toBeNull();
    expect(evaluateBudgetRunwayQuery("swap 50 USDG for ETH")).toBeNull();
  });
});
