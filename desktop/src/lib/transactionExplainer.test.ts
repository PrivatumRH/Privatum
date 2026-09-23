import { describe, expect, it } from "bun:test";
import { explainTransfer } from "./transactionExplainer";

describe("Transaction Simulation Explainer", () => {
  it("explains a native ETH transfer and threshold path", () => {
    const result = explainTransfer({ asset: "ETH", amount: "0.5", recipient: "0xabc", isStealthSend: false, simulationStatus: "success" });
    expect(result.operation).toBe("Threshold transfer");
    expect(result.movements[0]).toContain("0.5 ETH");
    expect(result.checks).toContain("2-of-3 threshold authorization required");
  });
  it("explains stealth execution and warns on fallback estimates", () => {
    const result = explainTransfer({ asset: "USDG", amount: "25", recipient: "st:eth:0xmeta", isStealthSend: true, simulationStatus: "warning", gasLimit: 65000n, gasPriceGwei: "1.06" });
    expect(result.executionPath).toContain("announce");
    expect(result.warning).toContain("65000");
  });
});
