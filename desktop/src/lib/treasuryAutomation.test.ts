import { describe, expect, it } from "bun:test";
import { buildTreasuryAutomationPlan, parseTreasuryAutomationPrompt } from "./treasuryAutomation";

describe("Treasury automation planning", () => {
  it("plans a percentage bridge without executing it", () => {
    const request = parseTreasuryAutomationPrompt("move 20% of idle USDG to Optimism if fees stay below 0.5%");
    expect(request?.action).toBe("bridge");
    const plan = buildTreasuryAutomationPlan(request!, { usdgBalance: 1000, ethBalance: 0.1 });
    expect(plan.amountNumber).toBe(200);
    expect(plan.canStage).toBe(true);
    expect(plan.steps.at(-1)?.status).toBe("warn");
  });

  it("blocks a gas reserve plan that would consume the reserve", () => {
    const request = parseTreasuryAutomationPrompt("rebalance treasury to keep 0.05 ETH gas reserve");
    const plan = buildTreasuryAutomationPlan(request!, { usdgBalance: 100, ethBalance: 0.01 });
    expect(plan.request.action).toBe("gas_reserve");
    expect(plan.canStage).toBe(false);
  });
});
