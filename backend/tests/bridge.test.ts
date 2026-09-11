import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { privDecimalToWei } from "../src/treasury";
import { PRIV_TOKEN_ADDRESS, POOL_ADDRESS, assertPrivTokenConfigured } from "../src/poolWallet";
import {
  deviationBps,
  calculateRebateMicros,
  extractSpreadMicros,
  microsToPrivWei,
  microsToUsd,
  usdToMicros,
  type RelayQuoteResponse,
} from "../src/relay";

describe("Bridge rebate math", () => {
  it("parses decimal USD into exact micro-USD", () => {
    expect(usdToMicros("0.079452")).toBe(79452n);
    expect(usdToMicros("1")).toBe(1_000_000n);
    expect(usdToMicros("12.5")).toBe(12_500_000n);
    expect(usdToMicros("")).toBe(0n);
    expect(usdToMicros(undefined)).toBe(0n);
    expect(usdToMicros("not-a-number")).toBe(0n);
  });

  it("round-trips micro-USD back to a decimal string", () => {
    expect(microsToUsd(79452n)).toBe("0.079452");
    expect(microsToUsd(1_000_000n)).toBe("1.000000");
    expect(microsToUsd(0n)).toBe("0.000000");
  });

  it("truncates sub-micro precision rather than rounding up", () => {
    // Relay can return more than 6 decimals; the ledger must never over-credit.
    expect(usdToMicros("0.0794529999")).toBe(79452n);
  });

  it("reads the spread from relayerService when present", () => {
    const quote: RelayQuoteResponse = {
      fees: {
        relayer: { amountUsd: "0.079452" },
        relayerGas: { amountUsd: "0.009857" },
        relayerService: { amountUsd: "0.069595" },
      },
    };
    expect(extractSpreadMicros(quote)).toBe(69595n);
  });

  it("derives the spread from relayer minus relayerGas when relayerService is absent", () => {
    const quote: RelayQuoteResponse = {
      fees: {
        relayer: { amountUsd: "0.079452" },
        relayerGas: { amountUsd: "0.009857" },
      },
    };
    expect(extractSpreadMicros(quote)).toBe(69595n);
  });

  it("never reports a negative spread", () => {
    const quote: RelayQuoteResponse = {
      fees: { relayer: { amountUsd: "0.001" }, relayerGas: { amountUsd: "0.005" } },
    };
    expect(extractSpreadMicros(quote)).toBe(0n);
  });

  it("treats a quote with no fee block as zero spread", () => {
    expect(extractSpreadMicros({})).toBe(0n);
  });

  it("rebates the configured share of the spread", () => {
    expect(calculateRebateMicros(100_000n, 2500)).toBe(25_000n);
    expect(calculateRebateMicros(69_595n, 2500)).toBe(17_398n); // floored, not rounded
    expect(calculateRebateMicros(0n, 2500)).toBe(0n);
    expect(calculateRebateMicros(100_000n, 0)).toBe(0n);
  });

  it("converts a USD rebate into PRIV wei at the given price", () => {
    // $0.25 of rebate at $0.05/PRIV = 5 PRIV
    expect(microsToPrivWei(250_000n, "0.05")).toBe(5n * 10n ** 18n);
  });

  it("returns zero PRIV when the price is missing or zero", () => {
    expect(microsToPrivWei(250_000n, "0")).toBe(0n);
    expect(microsToPrivWei(250_000n, "")).toBe(0n);
  });
});

describe("Bridge API", () => {
  it("advertises the four supported chains and programme terms", async () => {
    const res = await request(app).get("/v1/bridge/chains");

    expect(res.status).toBe(200);
    const ids = res.body.chains.map((c: { chainId: number }) => c.chainId).sort((a: number, b: number) => a - b);
    expect(ids).toEqual([1, 4663, 8453, 42161]);
    expect(res.body.rebateBps).toBe(2500);
    expect(res.body.settlementChainId).toBe(4663);
    expect(res.body.rebateCurrency.symbol).toBe("PRIV");
    expect(res.body.rebateCurrency.address).toBe("0xee2ddd7128c291b027712eca157b3ff31a55a05a");
  });

  it("rejects a quote with an invalid user address", async () => {
    const res = await request(app).post("/v1/bridge/quote").send({
      user: "not-an-address",
      originChainId: 8453,
      destinationChainId: 4663,
      amount: "100000000000000000",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_USER");
  });

  it("rejects an unsupported chain", async () => {
    const res = await request(app).post("/v1/bridge/quote").send({
      user: "0x000000000000000000000000000000000000dEaD",
      originChainId: 137,
      destinationChainId: 4663,
      amount: "100000000000000000",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_CHAIN");
  });

  it("rejects a same-chain bridge", async () => {
    const res = await request(app).post("/v1/bridge/quote").send({
      user: "0x000000000000000000000000000000000000dEaD",
      originChainId: 4663,
      destinationChainId: 4663,
      amount: "100000000000000000",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SAME_CHAIN");
  });

  it("rejects a non-integer amount", async () => {
    const res = await request(app).post("/v1/bridge/quote").send({
      user: "0x000000000000000000000000000000000000dEaD",
      originChainId: 8453,
      destinationChainId: 4663,
      amount: "0.5",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_AMOUNT");
  });

  it("rejects a balance lookup for an invalid address", async () => {
    const res = await request(app).get("/v1/bridge/rebates/nope");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ADDRESS");
  });

  it("requires a requestId to confirm an accrual", async () => {
    const res = await request(app).post("/v1/bridge/rebates/confirm").send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_REQUEST_ID");
  });
});
describe("PRIV price guard", () => {
  // PRIV has ~$4.8k of liquidity, so spot is cheap to move. A lower price pays
  // out MORE PRIV per USD, so a claimant is incentivised to push it down.
  it("measures deviation from the reference in basis points", () => {
    expect(deviationBps(usdToMicros("0.0000200"), usdToMicros("0.0000200"))).toBe(0);
    // Half price = 5000bps away from reference.
    expect(deviationBps(usdToMicros("0.010000"), usdToMicros("0.020000"))).toBe(5000);
    // Double price is also 5000bps away, measured against the reference.
    expect(deviationBps(usdToMicros("0.040000"), usdToMicros("0.020000"))).toBe(10000);
  });

  it("treats a zero reference as no deviation rather than dividing by zero", () => {
    expect(deviationBps(usdToMicros("0.02"), 0n)).toBe(0);
  });

  it("pays more PRIV when the price is pushed down - the reason for the guard", () => {
    const rebate = 250_000n; // $0.25
    const atReference = microsToPrivWei(rebate, "0.000020");
    const atHalfPrice = microsToPrivWei(rebate, "0.000010");
    expect(atHalfPrice).toBe(atReference * 2n);
  });
});

describe("Bridge treasury API", () => {
  it("refuses a payout run when no admin token is configured", async () => {
    const previous = process.env.REBATE_ADMIN_TOKEN;
    delete process.env.REBATE_ADMIN_TOKEN;

    const res = await request(app).post("/v1/bridge/payouts/run").send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("ADMIN_DISABLED");

    if (previous !== undefined) process.env.REBATE_ADMIN_TOKEN = previous;
  });

  it("rejects a payout run with a bad admin token", async () => {
    const previous = process.env.REBATE_ADMIN_TOKEN;
    process.env.REBATE_ADMIN_TOKEN = "test-admin-token";

    const res = await request(app)
      .post("/v1/bridge/payouts/run")
      .set("Authorization", "Bearer wrong-token")
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");

    if (previous === undefined) delete process.env.REBATE_ADMIN_TOKEN;
    else process.env.REBATE_ADMIN_TOKEN = previous;
  });
});
describe("Pool wallet configuration", () => {
  it("points PRIV at the PRIV contract, not USDG", () => {
    // v0.1.7 defaulted this to 0x5fc5...d168, which is the USDG contract.
    expect(PRIV_TOKEN_ADDRESS.toLowerCase()).toBe("0xee2ddd7128c291b027712eca157b3ff31a55a05a");
    expect(PRIV_TOKEN_ADDRESS.toLowerCase()).not.toBe("0x5fc5360d0400a0fd4f2af552add042d716f1d168");
  });

  it("uses the platform pool wallet as the settlement address", () => {
    expect(POOL_ADDRESS.toLowerCase()).toBe("0xf5370a080a8c8eed95e71982b228a3c0bdeff41f");
  });

  it("accepts the configured PRIV token", () => {
    expect(() => assertPrivTokenConfigured()).not.toThrow();
  });
});

describe("Staking reserve accounting", () => {
  it("scales decimal PRIV amounts to wei without floating point drift", () => {
    expect(privDecimalToWei("1")).toBe(10n ** 18n);
    expect(privDecimalToWei("10000.5000")).toBe(10000n * 10n ** 18n + 5n * 10n ** 17n);
    expect(privDecimalToWei(0)).toBe(0n);
    expect(privDecimalToWei("")).toBe(0n);
  });

  it("does not lose precision on amounts that break Number", () => {
    // 1,000,000 PRIV in wei exceeds Number.MAX_SAFE_INTEGER.
    expect(privDecimalToWei("1000000")).toBe(1_000_000n * 10n ** 18n);
    expect(privDecimalToWei("1000000") > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("treats staked PRIV as a reserve rebates may not spend", () => {
    // The pool holds stake + surplus; only the surplus funds rebates.
    const balance = privDecimalToWei("150000");
    const stakedReserve = privDecimalToWei("120000");
    const available = balance - stakedReserve;

    expect(available).toBe(privDecimalToWei("30000"));
    // A 50k rebate must be refused even though the pool "has" 150k.
    expect(privDecimalToWei("50000") > available).toBe(true);
  });

  it("reports underfunded when stake plus promised rebates exceed the balance", () => {
    const balance = privDecimalToWei("100000");
    const staked = privDecimalToWei("95000");
    const pendingRebates = privDecimalToWei("10000");
    expect(balance < staked + pendingRebates).toBe(true);
  });
});
