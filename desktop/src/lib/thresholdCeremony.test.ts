import { describe, it, expect } from "bun:test";
import {
  ceremonyComplete,
  ceremonyFailed,
  coSignerLatencyMs,
  createCeremony,
  gradeLatency,
  quorumReached,
  reduceCeremony,
  signaturesCollected,
  totalElapsedMs,
  type CeremonyStage,
} from "./thresholdCeremony";

function run(events: Parameters<typeof reduceCeremony>[1][]): CeremonyStage[] {
  return events.reduce((stages, e) => reduceCeremony(stages, e), createCeremony());
}

describe("Ceremony construction", () => {
  it("starts with every stage pending and no timings", () => {
    const stages = createCeremony();
    expect(stages).toHaveLength(6);
    expect(stages.every((s) => s.status === "pending")).toBe(true);
    expect(stages.every((s) => s.ms === undefined)).toBe(true);
  });

  it("orders stages as the send actually performs them", () => {
    expect(createCeremony().map((s) => s.id)).toEqual([
      "nonce",
      "userop",
      "shard_a",
      "shard_b",
      "combine",
      "submit",
    ]);
  });

  it("never represents shard C as a participant in a send", () => {
    const stages = createCeremony();
    expect(stages.some((s) => s.id.includes("shard_c"))).toBe(false);
    expect(stages.filter((s) => s.actor === "device")).toHaveLength(1);
    expect(stages.filter((s) => s.actor === "cosigner")).toHaveLength(1);
  });

  it("omits the nonce read for a standard transfer, which never performs one", () => {
    const standard = createCeremony("standard");
    expect(standard.map((s) => s.id)).toEqual([
      "userop",
      "shard_a",
      "shard_b",
      "combine",
      "submit",
    ]);
    expect(standard.some((s) => s.id === "nonce")).toBe(false);
  });

  it("keeps the nonce read for a batch send, which does perform one", () => {
    expect(createCeremony("batch").some((s) => s.id === "nonce")).toBe(true);
  });

  it("reset preserves the variant instead of reintroducing a phantom stage", () => {
    const standard = reduceCeremony(createCeremony("standard"), { type: "reset" });
    expect(standard.some((s) => s.id === "nonce")).toBe(false);
    const batch = reduceCeremony(createCeremony("batch"), { type: "reset" });
    expect(batch.some((s) => s.id === "nonce")).toBe(true);
  });

  it("returns a fresh array each call so state cannot leak between sends", () => {
    const a = createCeremony();
    a[0].status = "done";
    expect(createCeremony()[0].status).toBe("pending");
  });
});

describe("Reducer", () => {
  it("marks a stage active on start", () => {
    const stages = run([{ type: "start", id: "nonce" }]);
    expect(stages.find((s) => s.id === "nonce")?.status).toBe("active");
  });

  it("records duration on done", () => {
    const stages = run([
      { type: "start", id: "shard_b" },
      { type: "done", id: "shard_b", ms: 312 },
    ]);
    const b = stages.find((s) => s.id === "shard_b");
    expect(b?.status).toBe("done");
    expect(b?.ms).toBe(312);
  });

  it("leaves other stages untouched", () => {
    const stages = run([{ type: "done", id: "nonce", ms: 40 }]);
    expect(stages.filter((s) => s.status === "pending")).toHaveLength(5);
  });

  it("records an error on failure", () => {
    const stages = run([{ type: "fail", id: "shard_b", error: "co-signer unreachable" }]);
    const b = stages.find((s) => s.id === "shard_b");
    expect(b?.status).toBe("failed");
    expect(b?.error).toBe("co-signer unreachable");
  });

  it("clears a previous error when a stage is retried", () => {
    const stages = run([
      { type: "fail", id: "shard_b", error: "timeout" },
      { type: "start", id: "shard_b" },
    ]);
    const b = stages.find((s) => s.id === "shard_b");
    expect(b?.status).toBe("active");
    expect(b?.error).toBeUndefined();
  });

  it("reset returns a clean ceremony", () => {
    const stages = run([
      { type: "done", id: "nonce", ms: 10 },
      { type: "fail", id: "shard_b", error: "x" },
      { type: "reset" },
    ]);
    expect(stages.every((s) => s.status === "pending")).toBe(true);
  });

  it("does not mutate the array it is given", () => {
    const before = createCeremony();
    reduceCeremony(before, { type: "done", id: "nonce", ms: 5 });
    expect(before.find((s) => s.id === "nonce")?.status).toBe("pending");
  });
});

describe("Quorum accounting", () => {
  it("counts only shard signatures, not other stages", () => {
    const stages = run([
      { type: "done", id: "nonce", ms: 40 },
      { type: "done", id: "userop", ms: 2 },
      { type: "done", id: "submit", ms: 500 },
    ]);
    expect(signaturesCollected(stages)).toBe(0);
    expect(quorumReached(stages)).toBe(false);
  });

  it("one shard alone does not reach the threshold", () => {
    const stages = run([{ type: "done", id: "shard_a", ms: 1 }]);
    expect(signaturesCollected(stages)).toBe(1);
    expect(quorumReached(stages)).toBe(false);
  });

  it("two shards reach the threshold", () => {
    const stages = run([
      { type: "done", id: "shard_a", ms: 1 },
      { type: "done", id: "shard_b", ms: 280 },
    ]);
    expect(signaturesCollected(stages)).toBe(2);
    expect(quorumReached(stages)).toBe(true);
  });

  it("a shard that is merely active does not count toward quorum", () => {
    const stages = run([
      { type: "done", id: "shard_a", ms: 1 },
      { type: "start", id: "shard_b" },
    ]);
    expect(quorumReached(stages)).toBe(false);
  });
});

describe("Status helpers", () => {
  it("detects failure anywhere in the sequence", () => {
    expect(ceremonyFailed(run([{ type: "fail", id: "submit", error: "rejected" }]))).toBe(true);
    expect(ceremonyFailed(createCeremony())).toBe(false);
  });

  it("reports complete only when every stage is done", () => {
    const ids = ["nonce", "userop", "shard_a", "shard_b", "combine", "submit"] as const;
    const partial = run(ids.slice(0, 5).map((id) => ({ type: "done" as const, id, ms: 1 })));
    expect(ceremonyComplete(partial)).toBe(false);
    const full = run(ids.map((id) => ({ type: "done" as const, id, ms: 1 })));
    expect(ceremonyComplete(full)).toBe(true);
  });

  it("sums measured time across completed stages only", () => {
    const stages = run([
      { type: "done", id: "nonce", ms: 40 },
      { type: "done", id: "shard_b", ms: 260 },
      { type: "start", id: "submit" },
    ]);
    expect(totalElapsedMs(stages)).toBe(300);
  });
});

describe("Co-signer latency", () => {
  it("is null until shard B completes", () => {
    expect(coSignerLatencyMs(createCeremony())).toBeNull();
    expect(coSignerLatencyMs(run([{ type: "start", id: "shard_b" }]))).toBeNull();
  });

  it("is null when shard B failed", () => {
    const stages = run([{ type: "fail", id: "shard_b", error: "503" }]);
    expect(coSignerLatencyMs(stages)).toBeNull();
  });

  it("reports shard B's measured round-trip", () => {
    const stages = run([{ type: "done", id: "shard_b", ms: 412 }]);
    expect(coSignerLatencyMs(stages)).toBe(412);
  });

  it("grades latency by real thresholds", () => {
    expect(gradeLatency(120)).toBe("fast");
    expect(gradeLatency(249)).toBe("fast");
    expect(gradeLatency(250)).toBe("normal");
    expect(gradeLatency(999)).toBe("normal");
    expect(gradeLatency(1000)).toBe("slow");
    expect(gradeLatency(4200)).toBe("slow");
  });
});
