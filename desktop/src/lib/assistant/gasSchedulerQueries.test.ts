import { describe, it, expect } from "vitest";
import { evaluateGasSchedulerQuery } from "./gasSchedulerQueries";
import type { GasSchedulerContext } from "../gasScheduler";
import type { OfflineTransaction } from "../offlineOutbox";

const MOCK_OUTBOX: OfflineTransaction[] = [
  {
    id: "tx-test-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    nonce: 5,
    recipient: "0x2222222222222222222222222222222222222222",
    recipientLabel: "Charlie",
    amount: "500",
    asset: "USDG",
    chainId: 11155111,
    gasLimit: "65000",
    rawSignedTx: "0x01",
    txHash: "0x01",
    createdAt: Date.now(),
    status: "queued",
  },
];

const BASE_CTX: GasSchedulerContext = {
  offlineOutbox: MOCK_OUTBOX,
  gasPriceGwei: "1.75",
  ethPriceUsd: 2600,
  currentHourUtc: 14,
};

describe("evaluateGasSchedulerQuery", () => {
  it("triggers on 'When is the cheapest time to broadcast my queued payments?'", () => {
    const res = evaluateGasSchedulerQuery(
      "When is the cheapest time to broadcast my queued payments?",
      BASE_CTX
    );
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.intent.type).toBe("gas_scheduler");
    expect(res?.report.congestion.currentTier).toBe("congested");
  });

  it("triggers on 'Optimize gas for my outbox queue'", () => {
    const res = evaluateGasSchedulerQuery("Optimize gas for my outbox queue", BASE_CTX);
    expect(res).not.toBeNull();
    expect(res?.details.some((d) => d.includes("Projected Off-Peak Savings"))).toBe(true);
  });

  it("triggers on 'Schedule queued batch for low gas window'", () => {
    const res = evaluateGasSchedulerQuery("Schedule queued batch for low gas window", BASE_CTX);
    expect(res).not.toBeNull();
    expect(res?.report.targetGweiThreshold).toBeLessThanOrEqual(0.4);
  });

  it("triggers on 'Check gas congestion'", () => {
    const res = evaluateGasSchedulerQuery("Check gas congestion", BASE_CTX);
    expect(res).not.toBeNull();
    expect(res?.summary).toContain("Gas Market");
  });

  it("triggers on 'Is gas cheap right now?'", () => {
    const res = evaluateGasSchedulerQuery("Is gas cheap right now?", {
      ...BASE_CTX,
      gasPriceGwei: "0.25",
    });
    expect(res).not.toBeNull();
    expect(res?.report.congestion.currentTier).toBe("optimal");
  });

  it("triggers on 'What are current gas fees?'", () => {
    const res = evaluateGasSchedulerQuery("What are current gas fees?", BASE_CTX);
    expect(res).not.toBeNull();
  });

  it("returns null for unrelated queries", () => {
    expect(evaluateGasSchedulerQuery("send 10 ETH to Alice", BASE_CTX)).toBeNull();
    expect(evaluateGasSchedulerQuery("freeze wallet immediately", BASE_CTX)).toBeNull();
    expect(evaluateGasSchedulerQuery("what is my spending limit?", BASE_CTX)).toBeNull();
  });
});
