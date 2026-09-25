import { describe, it, expect } from "vitest";
import {
  findTokenBySymbol,
  parseSwapSimulationPrompt,
  simulateSwapExecution,
} from "./swapSimulator";

describe("swapSimulator", () => {
  describe("findTokenBySymbol", () => {
    it("resolves primary symbols case-insensitively", () => {
      expect(findTokenBySymbol("USDG")?.symbol).toBe("USDG");
      expect(findTokenBySymbol("eth")?.symbol).toBe("ETH");
      expect(findTokenBySymbol("priv")?.symbol).toBe("PRIV");
      expect(findTokenBySymbol("aapl")?.symbol).toBe("AAPL");
    });

    it("resolves common currency aliases", () => {
      expect(findTokenBySymbol("usd")?.symbol).toBe("USDG");
      expect(findTokenBySymbol("usdc")?.symbol).toBe("USDG");
      expect(findTokenBySymbol("dollar")?.symbol).toBe("USDG");
      expect(findTokenBySymbol("ether")?.symbol).toBe("ETH");
    });

    it("returns undefined for unknown symbols", () => {
      expect(findTokenBySymbol("UNKNOWN_TOKEN")).toBeUndefined();
    });
  });

  describe("parseSwapSimulationPrompt", () => {
    it("parses standard swap prompts", () => {
      const parsed = parseSwapSimulationPrompt("simulate swapping 500 USDG for ETH");
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenInSymbol).toBe("USDG");
      expect(parsed?.tokenOutSymbol).toBe("ETH");
      expect(parsed?.amountIn).toBe("500");
      expect(parsed?.slippagePercent).toBe(0.5);
      expect(parsed?.isRebalance).toBe(false);
    });

    it("parses swap prompts with custom slippage", () => {
      const parsed = parseSwapSimulationPrompt("swap 2 ETH to USDG with 1.5% slippage");
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenInSymbol).toBe("ETH");
      expect(parsed?.tokenOutSymbol).toBe("USDG");
      expect(parsed?.amountIn).toBe("2");
      expect(parsed?.slippagePercent).toBe(1.5);
    });

    it("parses percentage rebalance prompts with context balance", () => {
      const parsed = parseSwapSimulationPrompt("convert 25% of my USDG to ETH", {
        usdgBalance: "1000",
      });
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenInSymbol).toBe("USDG");
      expect(parsed?.tokenOutSymbol).toBe("ETH");
      expect(parsed?.amountIn).toBe("250.0000");
      expect(parsed?.isRebalance).toBe(true);
    });

    it("parses rebalance keywords as rebalance intents", () => {
      const parsed = parseSwapSimulationPrompt("rebalance 100 USDG to PRIV");
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenInSymbol).toBe("USDG");
      expect(parsed?.tokenOutSymbol).toBe("PRIV");
      expect(parsed?.amountIn).toBe("100");
      expect(parsed?.isRebalance).toBe(true);
    });

    it("parses alternate format: swap from X to Y amount N", () => {
      const parsed = parseSwapSimulationPrompt("swap from USDG to AAPL amount 50");
      expect(parsed).not.toBeNull();
      expect(parsed?.tokenInSymbol).toBe("USDG");
      expect(parsed?.tokenOutSymbol).toBe("AAPL");
      expect(parsed?.amountIn).toBe("50");
    });

    it("rejects non-swap queries or queries with identical source and destination", () => {
      expect(parseSwapSimulationPrompt("what is my current balance?")).toBeNull();
      expect(parseSwapSimulationPrompt("swap 100 USDG for USDG")).toBeNull();
    });
  });

  describe("simulateSwapExecution", () => {
    it("simulates USDG to ETH swap correctly", () => {
      const result = simulateSwapExecution(
        {
          tokenInSymbol: "USDG",
          tokenOutSymbol: "ETH",
          amountIn: "2800",
          slippagePercent: 1.0,
        },
        {
          usdgBalance: "5000",
          ethBalance: "1.0",
          ethPriceUsd: 2800,
        }
      );

      expect(result.tokenIn.symbol).toBe("USDG");
      expect(result.tokenOut.symbol).toBe("ETH");
      expect(result.amountInNumber).toBe(2800);
      expect(result.amountInUsd).toBe(2800);
      // At $2800/ETH, 2800 USDG should yield 1.0000 ETH
      expect(parseFloat(result.estimatedAmountOut)).toBeCloseTo(1.0, 3);
      // With 1% slippage, minimum out is ~0.99 ETH
      expect(parseFloat(result.minimumAmountOut)).toBeCloseTo(0.99, 3);
      expect(result.canExecute).toBe(true);

      // Balance diffs
      expect(result.balanceDiff.tokenIn.initial).toBe(5000);
      expect(result.balanceDiff.tokenIn.projected).toBe(2200);
      expect(result.balanceDiff.tokenOut.initial).toBe(1.0);
      expect(result.balanceDiff.tokenOut.projected).toBeCloseTo(2.0, 3);
    });

    it("flags insufficient balance warning and disables canExecute", () => {
      const result = simulateSwapExecution(
        {
          tokenInSymbol: "USDG",
          tokenOutSymbol: "ETH",
          amountIn: "10000",
        },
        {
          usdgBalance: "2500",
          ethBalance: "0.5",
        }
      );

      expect(result.canExecute).toBe(false);
      expect(result.warnings.some((w) => w.includes("Insufficient USDG"))).toBe(true);
    });

    it("flags low ETH reserve warning when swapping non-ETH token without gas", () => {
      const result = simulateSwapExecution(
        {
          tokenInSymbol: "USDG",
          tokenOutSymbol: "PRIV",
          amountIn: "100",
        },
        {
          usdgBalance: "500",
          ethBalance: "0.00001", // Below estimated 0.00015 ETH gas
        }
      );

      expect(result.warnings.some((w) => w.includes("Low ETH reserve"))).toBe(true);
    });

    it("flags high price impact warning for large orders", () => {
      const result = simulateSwapExecution(
        {
          tokenInSymbol: "USDG",
          tokenOutSymbol: "ETH",
          amountIn: "60000",
        },
        {
          usdgBalance: "100000",
          ethBalance: "5.0",
        }
      );

      expect(result.priceImpactPercent).toBeGreaterThanOrEqual(1.0);
      expect(result.warnings.some((w) => w.includes("High price impact"))).toBe(true);
    });

    it("includes RWA schedule notice when swapping to equity tokens", () => {
      const result = simulateSwapExecution(
        {
          tokenInSymbol: "USDG",
          tokenOutSymbol: "AAPL",
          amountIn: "230",
        },
        {
          usdgBalance: "1000",
          ethBalance: "1.0",
        }
      );

      expect(result.tokenOut.isRwa).toBe(true);
      expect(result.warnings.some((w) => w.includes("RWA asset notice"))).toBe(true);
    });

    it("customizes summary for treasury rebalance simulations", () => {
      const result = simulateSwapExecution({
        tokenInSymbol: "USDG",
        tokenOutSymbol: "ETH",
        amountIn: "500",
        isRebalance: true,
      });

      expect(result.isRebalance).toBe(true);
      expect(result.summary).toContain("Pre-Flight Treasury Rebalance Simulation");
    });
  });
});
