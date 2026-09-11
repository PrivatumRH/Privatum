import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { calculateStakingTier } from "../src/stakingTier";

describe("Staking Tier Model", () => {
  it("correctly identifies non-eligible stakes under 10,000 PRIV", () => {
    const t0 = calculateStakingTier(0);
    expect(t0.isEligible).toBe(false);
    expect(t0.monthlyQuota).toBe(0);

    const t9k = calculateStakingTier(9999);
    expect(t9k.isEligible).toBe(false);
    expect(t9k.monthlyQuota).toBe(0);
    expect(t9k.nextTierAmount).toBe(10000);
    expect(t9k.nextTierQuota).toBe(25);
  });

  it("calculates Tier 1 for 10k to <50k PRIV (25 txns/month)", () => {
    const t10k = calculateStakingTier(10000);
    expect(t10k.tierName).toBe("Tier 1");
    expect(t10k.monthlyQuota).toBe(25);
    expect(t10k.isEligible).toBe(true);
    expect(t10k.nextTierAmount).toBe(50000);
    expect(t10k.nextTierQuota).toBe(100);

    const t40k = calculateStakingTier(40000);
    expect(t40k.tierName).toBe("Tier 1");
    expect(t40k.monthlyQuota).toBe(25);
  });

  it("calculates Tier 2 for 50k PRIV (100 txns/month)", () => {
    const t50k = calculateStakingTier(50000);
    expect(t50k.tierName).toBe("Tier 2");
    expect(t50k.monthlyQuota).toBe(100);
    expect(t50k.isEligible).toBe(true);
    expect(t50k.nextTierAmount).toBe(100000);
    expect(t50k.nextTierQuota).toBe(175);
  });

  it("adds +75 txns for every 50k increment above 50k", () => {
    // 100k -> 100 + 75 = 175
    const t100k = calculateStakingTier(100000);
    expect(t100k.tierName).toBe("Tier 3");
    expect(t100k.monthlyQuota).toBe(175);

    // 150k -> 100 + 2*75 = 250
    const t150k = calculateStakingTier(150000);
    expect(t150k.tierName).toBe("Tier 4");
    expect(t150k.monthlyQuota).toBe(250);

    // 200k -> 100 + 3*75 = 325
    const t200k = calculateStakingTier(200000);
    expect(t200k.tierName).toBe("Tier 5");
    expect(t200k.monthlyQuota).toBe(325);
  });

  it("awards Unlimited transactions for >= 1,000,000 PRIV", () => {
    const t1m = calculateStakingTier(1000000);
    expect(t1m.tierName).toBe("Tier Unlimited");
    expect(t1m.monthlyQuota).toBe(-1);
    expect(t1m.isEligible).toBe(true);

    const t2m = calculateStakingTier(2000000);
    expect(t2m.tierName).toBe("Tier Unlimited");
    expect(t2m.monthlyQuota).toBe(-1);
  });
});

describe("Staking API Endpoints", () => {
  it("GET /v1/staking/config returns platform pool wallet and tier schedule", async () => {
    const res = await request(app).get("/v1/staking/config");
    expect(res.status).toBe(200);
    expect(res.body.platformPoolWallet).toBeDefined();
    expect(res.body.minStake).toBe(10000);
    expect(res.body.cycleDays).toBe(30);
    expect(Array.isArray(res.body.tiers)).toBe(true);
    expect(res.body.tiers.length).toBeGreaterThanOrEqual(4);
  });

  it("GET /v1/staking/status/:address returns default non-staked state for unknown address", async () => {
    const testAddr = "0x1111111111111111111111111111111111111111";
    const res = await request(app).get(`/v1/staking/status/${testAddr}`);
    expect(res.status).toBe(200);
    expect(res.body.walletAddress).toBe(testAddr.toLowerCase());
    expect(res.body.isStaked).toBe(false);
    expect(res.body.stakedAmount).toBe(0);
    expect(res.body.monthlyQuota).toBe(0);
    expect(res.body.quotaRemaining).toBe(0);
  });

  it("POST /v1/staking/stake rejects without valid authorization", async () => {
    const res = await request(app).post("/v1/staking/stake").send({
      walletAddress: "0x1111111111111111111111111111111111111111",
      amount: 10000,
      txHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
    });
    expect(res.status).toBe(401);
  });
});
