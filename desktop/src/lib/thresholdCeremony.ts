/**
 * Threshold Signing Ceremony - Privatum v0.1.22
 *
 * Models the real 2-of-3 signing sequence so the UI can show what actually
 * happened, with measured timings, rather than an animation that plays on a
 * timer regardless of the truth.
 *
 * Every stage here corresponds to work the app genuinely performs:
 *   nonce    - EntryPoint.getNonce read over RPC
 *   userop   - UserOperation assembled and hashed locally
 *   shard_a  - device key signs the hash locally (no network)
 *   shard_b  - co-signer signs over HTTPS (this timing IS co-signer latency)
 *   combine  - the two 65-byte signatures concatenated to 130 bytes
 *   submit   - UserOp handed to the bundler
 *
 * Shard C is deliberately represented as absent. It is the offline recovery
 * share and takes no part in a normal send; drawing it as a participant would
 * misrepresent the threshold.
 */

export type CeremonyStageId =
  | "nonce"
  | "userop"
  | "shard_a"
  | "shard_b"
  | "combine"
  | "submit";

export type CeremonyStageStatus = "pending" | "active" | "done" | "failed";

export type CeremonyActor = "device" | "cosigner" | "local" | "network";

export interface CeremonyStage {
  id: CeremonyStageId;
  label: string;
  actor: CeremonyActor;
  /** What this step does, in terms a holder can check against the code. */
  detail: string;
  status: CeremonyStageStatus;
  /** Measured duration once the stage completes. */
  ms?: number;
  error?: string;
}

export type CeremonyEvent =
  | { type: "reset" }
  | { type: "start"; id: CeremonyStageId }
  | { type: "done"; id: CeremonyStageId; ms: number }
  | { type: "fail"; id: CeremonyStageId; error: string };

const STAGE_TEMPLATE: Omit<CeremonyStage, "status">[] = [
  {
    id: "nonce",
    label: "Read account nonce",
    actor: "network",
    detail: "EntryPoint.getNonce for this smart account",
  },
  {
    id: "userop",
    label: "Build UserOperation",
    actor: "local",
    detail: "Assemble the ERC-4337 op and compute its hash",
  },
  {
    id: "shard_a",
    label: "Shard A signs",
    actor: "device",
    detail: "Device key, on this machine, never transmitted",
  },
  {
    id: "shard_b",
    label: "Shard B signs",
    actor: "cosigner",
    detail: "Co-signer quorum partner over HTTPS",
  },
  {
    id: "combine",
    label: "Combine quorum",
    actor: "local",
    detail: "Two 65-byte signatures into one 130-byte payload",
  },
  {
    id: "submit",
    label: "Submit to bundler",
    actor: "network",
    detail: "UserOperation broadcast for inclusion",
  },
];

/**
 * Which send is running. A batch (stealth) send reads the account nonce from
 * the EntryPoint itself; a standard transfer lets the SDK build the operation
 * and never performs that read. The variant exists so the visual never shows a
 * step the send does not actually take.
 */
export type CeremonyVariant = "batch" | "standard";

export function createCeremony(variant: CeremonyVariant = "batch"): CeremonyStage[] {
  return STAGE_TEMPLATE.filter((s) => !(variant === "standard" && s.id === "nonce")).map((s) => ({
    ...s,
    status: "pending" as const,
  }));
}

/**
 * Pure reducer, so the sequence can be tested without a wallet, a network, or
 * a running app.
 */
export function reduceCeremony(
  stages: CeremonyStage[],
  event: CeremonyEvent
): CeremonyStage[] {
  if (event.type === "reset") {
    // Preserve the variant already in play rather than silently reintroducing
    // a nonce stage that this send will never perform.
    return createCeremony(stages.some((s) => s.id === "nonce") ? "batch" : "standard");
  }

  return stages.map((stage) => {
    if (stage.id !== event.id) return stage;
    switch (event.type) {
      case "start":
        return { ...stage, status: "active", error: undefined };
      case "done":
        return { ...stage, status: "done", ms: event.ms, error: undefined };
      case "fail":
        return { ...stage, status: "failed", error: event.error };
    }
  });
}

/** How many of the three shares have actually signed. */
export function signaturesCollected(stages: CeremonyStage[]): number {
  return stages.filter(
    (s) => (s.id === "shard_a" || s.id === "shard_b") && s.status === "done"
  ).length;
}

/** True once the 2-of-3 threshold is genuinely met. */
export function quorumReached(stages: CeremonyStage[]): boolean {
  return signaturesCollected(stages) >= 2;
}

export function ceremonyFailed(stages: CeremonyStage[]): boolean {
  return stages.some((s) => s.status === "failed");
}

export function ceremonyComplete(stages: CeremonyStage[]): boolean {
  return stages.every((s) => s.status === "done");
}

/** Total measured time across completed stages. */
export function totalElapsedMs(stages: CeremonyStage[]): number {
  return stages.reduce((sum, s) => sum + (s.ms ?? 0), 0);
}

/**
 * Co-signer round-trip, surfaced on its own because it is the one number in
 * this flow that depends on infrastructure outside the user's machine.
 */
export function coSignerLatencyMs(stages: CeremonyStage[]): number | null {
  const b = stages.find((s) => s.id === "shard_b");
  return b?.status === "done" && typeof b.ms === "number" ? b.ms : null;
}

/**
 * Times one stage and reports it, returning the work's value untouched.
 *
 * Shared by every send path so the stealth batch and the standard transfer
 * report identically. Observation only: with no `onStage` this is a passthrough,
 * and a throw still propagates after being recorded.
 */
export async function timeStage<T>(
  id: CeremonyStageId,
  onStage: ((event: CeremonyEvent) => void) | undefined,
  work: () => Promise<T>
): Promise<T> {
  onStage?.({ type: "start", id });
  const started = performance.now();
  try {
    const value = await work();
    onStage?.({ type: "done", id, ms: Math.round(performance.now() - started) });
    return value;
  } catch (err: any) {
    onStage?.({ type: "fail", id, error: err?.message || String(err) });
    throw err;
  }
}

export type LatencyGrade = "fast" | "normal" | "slow";

export function gradeLatency(ms: number): LatencyGrade {
  if (ms < 250) return "fast";
  if (ms < 1000) return "normal";
  return "slow";
}
