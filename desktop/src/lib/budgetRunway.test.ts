import { describe, it, expect } from "vitest";
import {
  formatDurationMs,
  generateBudgetRunwayReport,
} from "./budgetRunway";
import type { SpendingGuardrailConfig, SpendingRecord } from "./spendGuardrails";
import type { OfflineTransaction } from "./offlineOutbox";

describe("budgetRunway", () => {
  const MOCK_CONFIG: SpendingGuardrailConfig = {
    enabled: true,
    dailyLimitUsd: 500,
    singleTxLimitUsd: 250,
    strictMode: false,
  };

  const NOW = 1700000000000;
  const ONE_HOUR = 60 * 60 * 1000;

  describe("formatDurationMs", () => {
    it("formats sub-hour durations in minutes", () => {
      expect(formatDurationMs(30 * 60 * 1000)).toBe("30m");
      expect(formatDurationMs(0)).toBe("0m");
    });

    it("formats multi-hour durations with hours and minutes", () => {
      expect(formatDurationMs(2 * ONE_HOUR + 15 * 60 * 1000)).toBe("2h 15m");
      expect(formatDurationMs(5 * ONE_HOUR)).toBe("5h 0m");
    });
  });

  describe("generateBudgetRunwayReport", () => {
    it("reports sustainable runway with full headroom when history is empty", () => {
      const report = generateBudgetRunwayReport({
        guardrailConfig: MOCK_CONFIG,
        spendingHistory: [],
        offlineOutbox: [],
        now: NOW,
      });

      expect(report.enabled).toBe(true);
      expect(report.dailyLimitUsd).toBe(500);
      expect(report.current24hSpentUsd).toBe(0);
      expect(report.remainingHeadroomUsd).toBe(500);
      expect(report.headroomPercent).toBe(100);
      expect(report.riskTier).toBe("sustainable");
      expect(report.willQueuedExceedLimit).toBe(false);
      expect(report.queuedOutboxCount).toBe(0);
      expect(report.formattedRunway).toContain("Ample runway");
    });

    it("correctly models rolling window resets and active burn rate", () => {
      // 1 record 10 hours ago ($150), 1 record 2 hours ago ($100) -> total $250
      const history: SpendingRecord[] = [
        {
          txHash: "0x111",
          timestamp: NOW - 10 * ONE_HOUR,
          amount: 150,
          symbol: "USDG",
          amountUsd: 150,
          recipient: "0xaaa",
        },
        {
          txHash: "0x222",
          timestamp: NOW - 2 * ONE_HOUR,
          amount: 100,
          symbol: "USDG",
          amountUsd: 100,
          recipient: "0xbbb",
        },
      ];

      const report = generateBudgetRunwayReport({
        guardrailConfig: MOCK_CONFIG,
        spendingHistory: history,
        offlineOutbox: [],
        now: NOW,
      });

      expect(report.current24hSpentUsd).toBe(250);
      expect(report.remainingHeadroomUsd).toBe(250);
      expect(report.headroomPercent).toBe(50);
      // Oldest active is 10 hours old, so it resets in 14 hours
      expect(report.resetWindow.amountExpiringUsd).toBe(150);
      expect(report.resetWindow.formattedTimeUntilReset).toBe("14h 0m");
      expect(report.recommendations.some((r) => r.includes("$150.00"))).toBe(true);
    });

    it("flags critical risk and limit breach when queued outbox exceeds headroom", () => {
      const history: SpendingRecord[] = [
        {
          txHash: "0x111",
          timestamp: NOW - 1 * ONE_HOUR,
          amount: 400,
          symbol: "USDG",
          amountUsd: 400,
          recipient: "0xaaa",
        },
      ];

      // $100 headroom remaining, but queued outbox has 150 USDG queued
      const outbox: OfflineTransaction[] = [
        {
          id: "queued-1",
          walletAddress: "0x111",
          nonce: 1,
          recipient: "0x222",
          amount: "150",
          asset: "USDG",
          chainId: 11155111,
          gasLimit: "21000",
          rawSignedTx: "0x02",
          txHash: "0x01",
          createdAt: NOW,
          status: "queued",
        },
      ];

      const report = generateBudgetRunwayReport({
        guardrailConfig: MOCK_CONFIG,
        spendingHistory: history,
        offlineOutbox: outbox,
        now: NOW,
      });

      expect(report.remainingHeadroomUsd).toBe(100);
      expect(report.queuedOutboxTotalUsd).toBe(150);
      expect(report.willQueuedExceedLimit).toBe(true);
      expect(report.projectedRemainingAfterOutboxUsd).toBe(-50);
      expect(report.riskTier).toBe("critical");
      expect(
        report.recommendations.some((r) => r.includes("exceed remaining daily limit by $50.00"))
      ).toBe(true);
    });

    it("flags exhausted risk tier when 24h limit is completely spent", () => {
      const history: SpendingRecord[] = [
        {
          txHash: "0x111",
          timestamp: NOW - 4 * ONE_HOUR,
          amount: 500,
          symbol: "USDG",
          amountUsd: 500,
          recipient: "0xaaa",
        },
      ];

      const report = generateBudgetRunwayReport({
        guardrailConfig: MOCK_CONFIG,
        spendingHistory: history,
        offlineOutbox: [],
        now: NOW,
      });

      expect(report.remainingHeadroomUsd).toBe(0);
      expect(report.headroomPercent).toBe(0);
      expect(report.riskTier).toBe("exhausted");
      expect(report.projectedRunwayDays).toBe(0);
      expect(report.formattedRunway).toContain("Depleted");
      expect(report.recommendations.some((r) => r.includes("Daily cap reached"))).toBe(true);
    });

    it("handles disabled guardrails gracefully", () => {
      const report = generateBudgetRunwayReport({
        guardrailConfig: { ...MOCK_CONFIG, enabled: false },
        spendingHistory: [],
        offlineOutbox: [],
        now: NOW,
      });

      expect(report.enabled).toBe(false);
      expect(report.riskTier).toBe("sustainable");
      expect(report.formattedRunway).toContain("Unlimited");
      expect(report.summary).toContain("Guardrails are disabled");
    });
  });
});
