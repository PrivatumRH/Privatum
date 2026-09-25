import { describe, it, expect } from "vitest";
import {
  parseBridgeSimulationPrompt,
  simulateBridgeExecution,
} from "./bridgeSimulator";

describe("bridgeSimulator", () => {
  describe("parseBridgeSimulationPrompt", () => {
    it("parses standard bridge to Base query", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 500 USDG to Base");
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe("500");
      expect(parsed?.amountNumber).toBe(500);
      expect(parsed?.originToken.symbol).toBe("USDG");
      expect(parsed?.destinationChain.name).toBe("Base");
      expect(parsed?.destinationToken.symbol).toBe("USDC");
    });

    it("parses bridge to Optimism with ETH", () => {
      const parsed = parseBridgeSimulationPrompt("Simulate bridging 1.5 ETH to Optimism");
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe("1.5");
      expect(parsed?.amountNumber).toBe(1.5);
      expect(parsed?.originToken.symbol).toBe("ETH");
      expect(parsed?.destinationChain.name).toBe("Optimism");
      expect(parsed?.destinationToken.symbol).toBe("ETH");
    });

    it("parses bridge to Base with specific destination asset cbBTC", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 1000 USDG to Base as cbBTC");
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe("1000");
      expect(parsed?.originToken.symbol).toBe("USDG");
      expect(parsed?.destinationChain.name).toBe("Base");
      expect(parsed?.destinationToken.symbol).toBe("cbBTC");
    });

    it("parses percentage-based bridge rebalance", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 25% of my USDG to Arbitrum", {
        portfolio: {
          usdgBalance: "2000",
        },
      });
      expect(parsed).not.toBeNull();
      expect(parsed?.isPercentage).toBe(true);
      expect(parsed?.amountNumber).toBe(500);
      expect(parsed?.destinationChain.name).toBe("Arbitrum One");
    });

    it("parses inquiry format how much on Base for amount", () => {
      const parsed = parseBridgeSimulationPrompt(
        "Cross-chain bridge: how much USDC on Base for 250 USDG"
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amountNumber).toBe(250);
      expect(parsed?.destinationChain.name).toBe("Base");
      expect(parsed?.destinationToken.symbol).toBe("USDC");
    });

    it("returns null for non-bridge queries", () => {
      expect(parseBridgeSimulationPrompt("Swap 500 USDG for ETH")).toBeNull();
      expect(parseBridgeSimulationPrompt("Show my wallet balance")).toBeNull();
      expect(parseBridgeSimulationPrompt("When is gas cheapest?")).toBeNull();
    });
  });

  describe("simulateBridgeExecution", () => {
    it("simulates USDG to Base USDC bridge with low fees and short delivery", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 500 USDG to Base")!;
      const sim = simulateBridgeExecution(parsed, {
        portfolio: {
          usdgBalance: "1000",
        },
      });

      expect(sim.canExecute).toBe(true);
      expect(sim.insufficientBalance).toBe(false);
      expect(sim.destinationChain.name).toBe("Base");
      expect(sim.tokenOut.symbol).toBe("USDC");
      expect(sim.fees.totalFeeUsd).toBeLessThan(1.0);
      expect(sim.estimatedTime).toBe("~20 - 30 seconds");
      expect(sim.balanceDiff.originBefore).toBe(1000);
      expect(sim.balanceDiff.originAfter).toBe(500);
    });

    it("simulates USDG to Base cbBTC and includes asset notice", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 6500 USDG to Base as cbBTC")!;
      const sim = simulateBridgeExecution(parsed, {
        portfolio: {
          usdgBalance: "10000",
        },
      });

      expect(sim.canExecute).toBe(true);
      expect(sim.tokenOut.symbol).toBe("cbBTC");
      expect(sim.estimatedAmountOutNumber).toBeCloseTo(0.1, 1);
      expect(
        sim.warnings.some((w) => w.includes("Coinbase Wrapped BTC (cbBTC)"))
      ).toBe(true);
    });

    it("simulates bridge to Ethereum L1 with higher gas fee notice", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 200 USDG to Ethereum")!;
      const sim = simulateBridgeExecution(parsed, {
        portfolio: {
          usdgBalance: "500",
        },
      });

      expect(sim.destinationChain.name).toBe("Ethereum");
      expect(sim.fees.destinationGasUsd).toBeGreaterThan(2.0);
      expect(sim.estimatedTime).toBe("~1 - 2 minutes");
      expect(
        sim.warnings.some((w) => w.includes("Ethereum Mainnet (L1) incurs higher"))
      ).toBe(true);
    });

    it("flags insufficient balance and prevents execution", () => {
      const parsed = parseBridgeSimulationPrompt("Bridge 1000 USDG to Optimism")!;
      const sim = simulateBridgeExecution(parsed, {
        portfolio: {
          usdgBalance: "150",
        },
      });

      expect(sim.insufficientBalance).toBe(true);
      expect(sim.canExecute).toBe(false);
      expect(
        sim.warnings.some((w) => w.includes("Insufficient USDG balance"))
      ).toBe(true);
    });
  });
});
