import { describe, it, expect } from "vitest";
import { evaluateBridgeSimulationQuery } from "./bridgeSimulatorQueries";

describe("bridgeSimulatorQueries", () => {
  it("evaluates natural language bridge queries to Base", () => {
    const result = evaluateBridgeSimulationQuery("Bridge 500 USDG to Base", {
      portfolio: {
        usdgBalance: "1000",
      },
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent.type).toBe("bridge_simulation");
    expect(result?.simulation.destinationChain.name).toBe("Base");
    expect(result?.simulation.tokenOut.symbol).toBe("USDC");
    expect(result?.details.some((d) => d.includes("Robinhood Chain (4663) -> Base"))).toBe(true);
    expect(result?.details.some((d) => d.includes("Relay Solver Fee:"))).toBe(true);
  });

  it("evaluates bridge queries with specific Base asset cbBTC", () => {
    const result = evaluateBridgeSimulationQuery("Bridge 1000 USDG to Base as cbBTC", {
      portfolio: {
        usdgBalance: "2000",
      },
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.tokenOut.symbol).toBe("cbBTC");
    expect(result?.details.some((d) => d.includes("cbBTC"))).toBe(true);
  });

  it("evaluates bridge simulation to Optimism with ETH", () => {
    const result = evaluateBridgeSimulationQuery("Simulate bridging 2 ETH to Optimism", {
      portfolio: {
        ethBalance: "5.0",
        ethPrice: 2800,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.destinationChain.name).toBe("Optimism");
    expect(result?.simulation.tokenOut.symbol).toBe("ETH");
    expect(result?.details.some((d) => d.includes("Optimism"))).toBe(true);
  });

  it("flags insufficient balance in bridge evaluation", () => {
    const result = evaluateBridgeSimulationQuery("Bridge 5000 USDG to Base", {
      portfolio: {
        usdgBalance: "200",
      },
    });

    expect(result).not.toBeNull();
    expect(result?.simulation.insufficientBalance).toBe(true);
    expect(result?.simulation.canExecute).toBe(false);
    expect(result?.details.some((d) => d.includes("Insufficient USDG balance"))).toBe(true);
  });

  it("returns null for non-bridge queries", () => {
    expect(evaluateBridgeSimulationQuery("hello assistant")).toBeNull();
    expect(evaluateBridgeSimulationQuery("swap 50 USDG for ETH")).toBeNull();
    expect(evaluateBridgeSimulationQuery("check cosigner health")).toBeNull();
  });
});
