import { describe, it, expect } from "vitest";
import { evaluateShardHealthQuery } from "./shardHealthQueries";
import type { ShardHealthContext } from "../shardHealth";
import type { CeremonyStage } from "../thresholdCeremony";

const MOCK_CEREMONY: CeremonyStage[] = [
  { id: "nonce", status: "done", ms: 45, actor: "network" },
  { id: "userop", status: "done", ms: 2, actor: "device" },
  { id: "shard_a", status: "done", ms: 8, actor: "device" },
  { id: "shard_b", status: "done", ms: 120, actor: "cosigner" },
  { id: "combine", status: "done", ms: 1, actor: "device" },
  { id: "submit", status: "done", ms: 150, actor: "network" },
];

const MOCK_CTX: ShardHealthContext = {
  shardAPrivKey: "0x1111111111111111111111111111111111111111111111111111111111111111",
  walletAddress: "0x1234567890123456789012345678901234567890",
  shardBAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  cosignerApiUrl: "https://cosigner.privatum.io",
  isOnline: true,
  forceAirGap: false,
  confirmedNonce: 3,
  recentCeremony: MOCK_CEREMONY,
};

describe("evaluateShardHealthQuery", () => {
  it("triggers on 'Check cosigner health'", () => {
    const res = evaluateShardHealthQuery("Check cosigner health", MOCK_CTX);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.intent.type).toBe("shard_health");
    expect(res?.report.shardB.status).toBe("healthy");
  });

  it("triggers on 'Diagnose threshold signing performance'", () => {
    const res = evaluateShardHealthQuery("Diagnose threshold signing performance", MOCK_CTX);
    expect(res).not.toBeNull();
    expect(res?.report.ceremony?.totalElapsedMs).toBe(326);
  });

  it("triggers on 'Test Shard B connection'", () => {
    const res = evaluateShardHealthQuery("Test Shard B connection", MOCK_CTX);
    expect(res).not.toBeNull();
    expect(res?.intent.type).toBe("shard_health");
  });

  it("triggers on 'How fast is my threshold ceremony?'", () => {
    const res = evaluateShardHealthQuery("How fast is my threshold ceremony?", MOCK_CTX);
    expect(res).not.toBeNull();
    expect(res?.summary).toContain("Threshold MPC Shard Health");
  });

  it("triggers on 'shard health'", () => {
    const res = evaluateShardHealthQuery("shard health", MOCK_CTX);
    expect(res).not.toBeNull();
  });

  it("triggers on 'Check shard A'", () => {
    const res = evaluateShardHealthQuery("Check shard A", MOCK_CTX);
    expect(res).not.toBeNull();
    expect(res?.report.shardA.isLoaded).toBe(true);
  });

  it("triggers on 'is shard b online'", () => {
    const res = evaluateShardHealthQuery("is shard b online", MOCK_CTX);
    expect(res).not.toBeNull();
  });

  it("returns null for unrelated queries", () => {
    expect(evaluateShardHealthQuery("send 5 ETH to Alice", MOCK_CTX)).toBeNull();
    expect(evaluateShardHealthQuery("what is my balance", MOCK_CTX)).toBeNull();
    expect(evaluateShardHealthQuery("how do I stake", MOCK_CTX)).toBeNull();
  });
});
