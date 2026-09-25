import { describe, it, expect } from "vitest";
import {
  parseGasPriceGwei,
  getCongestionTier,
  evaluateCongestionWindow,
  analyzeOutboxFees,
  generateGasOptimizationReport,
} from "./gasScheduler";
import type { OfflineTransaction } from "./offlineOutbox";

const MOCK_OUTBOX: OfflineTransaction[] = [
  {
    id: "tx-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    nonce: 1,
    recipient: "0x2222222222222222222222222222222222222222",
    recipientLabel: "Alice",
    amount: "1.0",
    asset: "ETH",
    chainId: 11155111,
    gasLimit: "21000",
    maxFeePerGas: "2000000000", // 2 Gwei
    rawSignedTx: "0x02",
    txHash: "0x01",
    createdAt: Date.now(),
    status: "queued",
  },
  {
    id: "tx-2",
    walletAddress: "0x1111111111111111111111111111111111111111",
    nonce: 2,
    recipient: "0x3333333333333333333333333333333333333333",
    recipientLabel: "Bob",
    amount: "250.0",
    asset: "USDG",
    chainId: 11155111,
    gasLimit: "65000",
    maxFeePerGas: "500000000", // 0.5 Gwei
    rawSignedTx: "0x02",
    txHash: "0x02",
    createdAt: Date.now(),
    status: "queued",
  },
  {
    id: "tx-3",
    walletAddress: "0x1111111111111111111111111111111111111111",
    nonce: 3,
    recipient: "0x4444444444444444444444444444444444444444",
    amount: "10.0",
    asset: "USDG",
    chainId: 11155111,
    gasLimit: "65000",
    rawSignedTx: "0x02",
    txHash: "0x03",
    createdAt: Date.now(),
    status: "broadcasted", // Not queued!
  },
];

describe("gasScheduler", () => {
  describe("parseGasPriceGwei", () => {
    it("parses valid float string", () => {
      expect(parseGasPriceGwei("0.85")).toBe(0.85);
    });
    it("parses valid number", () => {
      expect(parseGasPriceGwei(1.5)).toBe(1.5);
    });
    it("falls back to default on invalid inputs", () => {
      expect(parseGasPriceGwei(undefined)).toBe(1.06);
      expect(parseGasPriceGwei("")).toBe(1.06);
      expect(parseGasPriceGwei(-5)).toBe(1.06);
    });
  });

  describe("getCongestionTier", () => {
    it("identifies optimal gas", () => {
      expect(getCongestionTier(0.2)).toBe("optimal");
      expect(getCongestionTier(0.4)).toBe("optimal");
    });
    it("identifies moderate gas", () => {
      expect(getCongestionTier(0.7)).toBe("moderate");
      expect(getCongestionTier(1.2)).toBe("moderate");
    });
    it("identifies congested gas", () => {
      expect(getCongestionTier(1.8)).toBe("congested");
      expect(getCongestionTier(5.0)).toBe("congested");
    });
  });

  describe("evaluateCongestionWindow", () => {
    it("recommends immediate broadcast during optimal gas", () => {
      const window = evaluateCongestionWindow(0.3, 14);
      expect(window.currentTier).toBe("optimal");
      expect(window.recommendation).toBe("broadcast_now");
      expect(window.explanation).toContain("exceptionally low");
    });

    it("recommends holding during congested periods", () => {
      const window = evaluateCongestionWindow(2.5, 14);
      expect(window.currentTier).toBe("congested");
      expect(window.recommendation).toBe("hold_for_window");
      expect(window.explanation).toContain("strongly advised");
    });

    it("calculates estimated wait hours until off-peak window", () => {
      const window = evaluateCongestionWindow(1.5, 23); // 23:00 UTC -> 03:00 UTC is 4 hours
      expect(window.estimatedWaitHours).toBe(4);
    });
  });

  describe("analyzeOutboxFees", () => {
    it("accurately computes queued item costs and potential savings", () => {
      const analysis = analyzeOutboxFees(MOCK_OUTBOX, 1.5, 0.4, 3000);
      expect(analysis.queuedCount).toBe(2); // tx-3 is broadcasted, ignored
      expect(analysis.totalGasUnits).toBe(86000); // 21000 + 65000
      expect(analysis.currentCostEth).toBeCloseTo((86000 * 1.5) / 1e9, 8);
      expect(analysis.projectedSavingsPercent).toBeGreaterThan(60);
      expect(analysis.items.length).toBe(2);
    });

    it("handles empty outbox gracefully", () => {
      const analysis = analyzeOutboxFees([], 1.0, 0.4, 3000);
      expect(analysis.queuedCount).toBe(0);
      expect(analysis.totalGasUnits).toBe(0);
      expect(analysis.currentCostUsd).toBe(0);
      expect(analysis.projectedSavingsPercent).toBe(0);
    });

    it("flags underpriced items if fee cap is below current market", () => {
      const analysis = analyzeOutboxFees(MOCK_OUTBOX, 2.0, 0.4, 3000);
      const bobTx = analysis.items.find((i) => i.recipientLabel === "Bob");
      // Bob's maxFeePerGas is 0.5 Gwei while current is 2.0 Gwei (0.5 < 2.0 * 0.7)
      expect(bobTx?.status).toBe("underpriced");
    });
  });

  describe("generateGasOptimizationReport", () => {
    it("generates a full structured report for active outbox", () => {
      const report = generateGasOptimizationReport({
        offlineOutbox: MOCK_OUTBOX,
        gasPriceGwei: "1.8",
        ethPriceUsd: 2500,
        currentHourUtc: 12,
      });

      expect(report.currentGwei).toBe(1.8);
      expect(report.congestion.currentTier).toBe("congested");
      expect(report.outboxAnalysis.queuedCount).toBe(2);
      expect(report.summary).toContain("Gas Market");
      expect(report.actionableAdvice.length).toBeGreaterThan(0);
      expect(report.targetGweiThreshold).toBeLessThanOrEqual(0.4);
    });

    it("generates advice for empty outbox", () => {
      const report = generateGasOptimizationReport({
        offlineOutbox: [],
        gasPriceGwei: "0.25",
      });

      expect(report.congestion.currentTier).toBe("optimal");
      expect(report.actionableAdvice[0]).toContain("Outbox is clear");
    });
  });
});
