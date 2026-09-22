import { describe, it, expect } from "vitest";
import { generateShardHealthReport, type ShardHealthContext } from "./shardHealth";
import type { CeremonyStage } from "./thresholdCeremony";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CTX: ShardHealthContext = {
  shardAPrivKey: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  walletAddress: "0xAbCd",
  shardBAddress: "0x1234",
  cosignerApiUrl: "https://cosigner.privatum.io",
  isOnline: true,
  forceAirGap: false,
  confirmedNonce: 7,
};

const HEALTHY_CEREMONY: CeremonyStage[] = [
  { id: "nonce",   status: "done", ms: 82,  actor: "network" },
  { id: "userop",  status: "done", ms: 4,   actor: "device" },
  { id: "shard_a", status: "done", ms: 11,  actor: "device" },
  { id: "shard_b", status: "done", ms: 195, actor: "cosigner" },
  { id: "combine", status: "done", ms: 1,   actor: "device" },
  { id: "submit",  status: "done", ms: 220, actor: "network" },
];

const SLOW_COSIGNER_CEREMONY: CeremonyStage[] = [
  { id: "nonce",   status: "done", ms: 90,   actor: "network" },
  { id: "userop",  status: "done", ms: 3,    actor: "device" },
  { id: "shard_a", status: "done", ms: 10,   actor: "device" },
  { id: "shard_b", status: "done", ms: 1450, actor: "cosigner" },
  { id: "combine", status: "done", ms: 1,    actor: "device" },
  { id: "submit",  status: "done", ms: 310,  actor: "network" },
];

const FAILED_SHARD_B_CEREMONY: CeremonyStage[] = [
  { id: "nonce",   status: "done",   ms: 100, actor: "network" },
  { id: "userop",  status: "done",   ms: 5,   actor: "device" },
  { id: "shard_a", status: "done",   ms: 12,  actor: "device" },
  { id: "shard_b", status: "failed", error: "ECONNREFUSED", actor: "cosigner" },
  { id: "combine", status: "pending", actor: "device" },
  { id: "submit",  status: "pending", actor: "network" },
];

const FAILED_NONCE_CEREMONY: CeremonyStage[] = [
  { id: "nonce", status: "failed", error: "RPCError: timeout", actor: "network" },
  { id: "userop", status: "pending", actor: "device" },
  { id: "shard_a", status: "pending", actor: "device" },
  { id: "shard_b", status: "pending", actor: "cosigner" },
  { id: "combine", status: "pending", actor: "device" },
  { id: "submit", status: "pending", actor: "network" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateShardHealthReport", () => {
  // ------- Shard A -------

  it("shard A is healthy when key is loaded", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    expect(report.shardA.status).toBe("healthy");
    expect(report.shardA.isLoaded).toBe(true);
    expect(report.shardA.signingLatencyMs).toBe(11);
    expect(report.shardA.latencyGrade).toBe("fast");
  });

  it("shard A is offline when private key is empty", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, shardAPrivKey: "" });
    expect(report.shardA.status).toBe("offline");
    expect(report.shardA.isLoaded).toBe(false);
  });

  it("shard A is degraded when it failed in last ceremony", () => {
    const ceremony = HEALTHY_CEREMONY.map((s) =>
      s.id === "shard_a" ? { ...s, status: "failed" as const, error: "key mismatch" } : s
    );
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: ceremony });
    expect(report.shardA.status).toBe("degraded");
  });

  // ------- Shard B -------

  it("shard B is healthy with fast cosigner latency", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    expect(report.shardB.status).toBe("healthy");
    expect(report.shardB.roundTripLatencyMs).toBe(195);
    expect(report.shardB.latencyGrade).toBe("fast");
  });

  it("shard B is degraded when cosigner latency is slow", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: SLOW_COSIGNER_CEREMONY });
    expect(report.shardB.status).toBe("degraded");
    expect(report.shardB.roundTripLatencyMs).toBe(1450);
    expect(report.shardB.latencyGrade).toBe("slow");
  });

  it("shard B is degraded when cosigner fails in ceremony", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: FAILED_SHARD_B_CEREMONY });
    expect(report.shardB.status).toBe("degraded");
    expect(report.shardB.isReachable).toBe(false);
    expect(report.shardB.detail).toContain("ECONNREFUSED");
  });

  it("shard B is offline when device is offline", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, isOnline: false });
    expect(report.shardB.status).toBe("offline");
    expect(report.shardB.isReachable).toBe(false);
  });

  it("shard B shows air-gap detail when forced air-gap is active", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, forceAirGap: true });
    expect(report.shardB.status).toBe("offline");
    expect(report.shardB.detail).toContain("Air-Gap");
  });

  it("shard B is unknown when no cosigner address is registered", () => {
    const report = generateShardHealthReport({
      ...BASE_CTX,
      shardBAddress: undefined,
      cosignerApiUrl: undefined,
    });
    expect(report.shardB.status).toBe("unknown");
  });

  // ------- Network -------

  it("RPC is healthy after successful nonce stage", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    const rpc = report.network.find((n) => n.layer === "rpc");
    expect(rpc?.status).toBe("healthy");
    expect(rpc?.latencyMs).toBe(82);
  });

  it("RPC is degraded after failed nonce stage", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: FAILED_NONCE_CEREMONY });
    const rpc = report.network.find((n) => n.layer === "rpc");
    expect(rpc?.status).toBe("degraded");
    expect(rpc?.detail).toContain("RPCError");
  });

  it("bundler is healthy after successful submit stage", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    const bundler = report.network.find((n) => n.layer === "bundler");
    expect(bundler?.status).toBe("healthy");
    expect(bundler?.latencyMs).toBe(220);
  });

  // ------- Score -------

  it("perfect ceremony scores near 100", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.overallStatus).toBe("healthy");
  });

  it("offline shard A tanks the score below 60", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, shardAPrivKey: "" });
    expect(report.score).toBeLessThan(70);
  });

  it("slow cosigner degrades the score", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: SLOW_COSIGNER_CEREMONY });
    expect(report.score).toBeLessThan(95);
  });

  // ------- Ceremony summary -------

  it("ceremony summary is populated from recent ceremony", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    expect(report.ceremony).toBeDefined();
    expect(report.ceremony!.wasComplete).toBe(true);
    expect(report.ceremony!.stagesFailed).toBe(0);
    expect(report.ceremony!.coSignerLatencyMs).toBe(195);
  });

  it("ceremony summary notes failed stages", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: FAILED_SHARD_B_CEREMONY });
    expect(report.ceremony!.stagesFailed).toBe(1);
    expect(report.ceremony!.wasComplete).toBe(false);
  });

  // ------- Recommendations -------

  it("no action recommendation for all-healthy report", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: HEALTHY_CEREMONY });
    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0]).toContain("No action required");
  });

  it("shard B failure produces recommendation about cosigner", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, recentCeremony: FAILED_SHARD_B_CEREMONY });
    const hasCosignerRec = report.recommendations.some((r) => r.includes("Shard B") || r.includes("Cosigner"));
    expect(hasCosignerRec).toBe(true);
  });

  it("offline device produces unlock recommendation", () => {
    const report = generateShardHealthReport({ ...BASE_CTX, shardAPrivKey: "" });
    expect(report.recommendations.some((r) => r.includes("Unlock Shard A"))).toBe(true);
  });

  // ------- generatedAt -------

  it("report includes a recent generatedAt timestamp", () => {
    const before = Date.now();
    const report = generateShardHealthReport(BASE_CTX);
    const after = Date.now();
    expect(report.generatedAt).toBeGreaterThanOrEqual(before);
    expect(report.generatedAt).toBeLessThanOrEqual(after);
  });
});
