import { describe, it, expect } from "vitest";
import { evaluateSwapSimulationQuery } from "./swapSimulatorQueries";

describe("swapSimulatorQueries", () => {
  it("evaluates natural language swap simulation queries", () => {
    const result = evaluateSwapSimulationQuery("simulate swapping 500 USDG for ETH", {
      usdgBalance: "2500",
      ethBalance: "1.5",
      ethPriceUsd: 2500,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent.type).toBe("swap_simulation");
    expect(result?.simulation.tokenIn.symbol).toBe("USDG");
    expect(result?.simulation.tokenOut.symbol).toBe("ETH");
    expect(result?.simulation.amountInNumber).toBe(500);
    expect(result?.simulation.canExecute).toBe(true);
    expect(result?.details.some((d) => d.includes("Route:"))).toBe(true);
    expect(result?.details.some((d) => d.includes("Effective Rate:"))).toBe(true);
    expect(result?.details.some((d) => d.includes("Pre-flight status: Validated"))).toBe(true);
  });

  it("handles percentage-based treasury rebalances", () => {
    const result = evaluateSwapSimulationQuery("convert 20% of my USDG to ETH", {
      usdgBalance: "2000",
      ethBalance: "0.8",
      ethPriceUsd: 2500,
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.isRebalance).toBe(true);
    expect(result?.simulation.amountInNumber).toBe(400); // 20% of 2000
    expect(result?.summary).toContain("Pre-Flight Treasury Rebalance Simulation");
  });

  it("evaluates custom slippage correctly in details", () => {
    const result = evaluateSwapSimulationQuery("swap 100 USDG to PRIV with 2% slippage", {
      usdgBalance: "500",
      ethBalance: "0.1",
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.slippageTolerancePercent).toBe(2);
    expect(result?.details.some((d) => d.includes("Minimum Received (2% slippage)"))).toBe(true);
  });

  it("flags insufficient balance and updates pre-flight status", () => {
    const result = evaluateSwapSimulationQuery("swap 5000 USDG to ETH", {
      usdgBalance: "100",
      ethBalance: "0.5",
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.canExecute).toBe(false);
    expect(result?.details.some((d) => d.includes("Insufficient USDG"))).toBe(true);
    expect(result?.details.some((d) => d.includes("Execution blocked due to balance constraints"))).toBe(true);
  });

  it("returns null for non-swap queries", () => {
    expect(evaluateSwapSimulationQuery("what is my current balance?")).toBeNull();
    expect(evaluateSwapSimulationQuery("check the latest block")).toBeNull();
    expect(evaluateSwapSimulationQuery("hello assistant")).toBeNull();
  });
});
