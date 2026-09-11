import { describe, it, expect } from "bun:test";
import { calculateStakingTier } from "../src/staking.js";

describe("SDK Staking Tier Calculations", () => {
  it("computes tiers matching the protocol specifications", () => {
    expect(calculateStakingTier(5000).isEligible).toBe(false);

    // 10k PRIV -> Tier 1 (25 txns)
    const t1 = calculateStakingTier(10000);
    expect(t1.isEligible).toBe(true);
    expect(t1.tierName).toBe("Tier 1");
    expect(t1.monthlyQuota).toBe(25);

    // 50k PRIV -> Tier 2 (100 txns)
    const t2 = calculateStakingTier(50000);
    expect(t2.isEligible).toBe(true);
    expect(t2.tierName).toBe("Tier 2");
    expect(t2.monthlyQuota).toBe(100);

    // 100k PRIV -> Tier 3 (175 txns)
    const t3 = calculateStakingTier(100000);
    expect(t3.monthlyQuota).toBe(175);

    // 150k PRIV -> Tier 4 (250 txns)
    const t4 = calculateStakingTier(150000);
    expect(t4.monthlyQuota).toBe(250);

    // 1,000,000 PRIV -> Tier Unlimited (-1)
    const tUnl = calculateStakingTier(1000000);
    expect(tUnl.tierName).toBe("Tier Unlimited");
    expect(tUnl.monthlyQuota).toBe(-1);
  });
});
