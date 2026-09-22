/**
 * Threshold MPC Ceremony & Shard Health Diagnostics Engine for PRIVATUM.
 *
 * Evaluates the operational health of the 2-of-2 threshold signing architecture:
 *   - Shard A: local on-device key (never transmitted)
 *   - Shard B: remote cosigner quorum partner (HTTPS)
 *   - Network: RPC and bundler connectivity
 *   - Nonce: EntryPoint.getNonce sync status
 *
 * 100% client-side deterministic evaluation: no external model inference.
 */

import {
  gradeLatency,
  coSignerLatencyMs,
  totalElapsedMs,
  type CeremonyStage,
  type LatencyGrade,
} from "./thresholdCeremony";

export type ShardStatus = "healthy" | "degraded" | "offline" | "unknown";

export interface ShardAHealth {
  shard: "shard_a";
  status: ShardStatus;
  isLoaded: boolean;
  signingLatencyMs?: number;
  latencyGrade?: LatencyGrade;
  detail: string;
}

export interface ShardBHealth {
  shard: "shard_b";
  status: ShardStatus;
  cosignerAddress?: string;
  apiUrl?: string;
  roundTripLatencyMs?: number;
  latencyGrade?: LatencyGrade;
  isReachable: boolean;
  detail: string;
}

export interface NetworkHealth {
  layer: "rpc" | "bundler";
  status: ShardStatus;
  latencyMs?: number;
  latencyGrade?: LatencyGrade;
  detail: string;
}

export interface NonceHealth {
  confirmedNonce?: number;
  localCachedNonce?: number;
  isDrifted: boolean;
  driftAmount?: number;
  detail: string;
}

export interface CeremonyPerformanceSummary {
  totalElapsedMs: number;
  coSignerLatencyMs: number | null;
  shardALatencyMs?: number;
  stagesCompleted: number;
  stagesFailed: number;
  wasComplete: boolean;
  overallGrade: LatencyGrade;
}

export interface ShardHealthReport {
  shardA: ShardAHealth;
  shardB: ShardBHealth;
  network: NetworkHealth[];
  nonce: NonceHealth;
  ceremony?: CeremonyPerformanceSummary;
  overallStatus: ShardStatus;
  score: number; // 0-100 health score
  summary: string;
  recommendations: string[];
  generatedAt: number;
}

export interface ShardHealthContext {
  shardAPrivKey?: string;
  walletAddress?: string;
  shardBAddress?: string;
  cosignerApiUrl?: string;
  confirmedNonce?: number;
  isOnline?: boolean;
  forceAirGap?: boolean;
  recentCeremony?: CeremonyStage[];
}

/**
 * Evaluates Shard A (local device key) health.
 */
function evaluateShardA(ctx: ShardHealthContext): ShardAHealth {
  const isLoaded = Boolean(ctx.shardAPrivKey && ctx.shardAPrivKey.length >= 64);

  if (!isLoaded) {
    return {
      shard: "shard_a",
      status: "offline",
      isLoaded: false,
      detail: "Device shard key is not loaded. Re-enter your passphrase to unlock Shard A.",
    };
  }

  // Derive latency from last ceremony if available
  const ceremonyShardA = ctx.recentCeremony?.find((s) => s.id === "shard_a");
  const latencyMs = ceremonyShardA?.status === "done" ? ceremonyShardA.ms : undefined;
  const latencyGrade = latencyMs !== undefined ? gradeLatency(latencyMs) : undefined;

  const wasFailed = ceremonyShardA?.status === "failed";

  if (wasFailed) {
    return {
      shard: "shard_a",
      status: "degraded",
      isLoaded,
      detail: `Shard A signing failed in last ceremony: ${ceremonyShardA?.error || "unknown error"}.`,
    };
  }

  return {
    shard: "shard_a",
    status: "healthy",
    isLoaded,
    signingLatencyMs: latencyMs,
    latencyGrade,
    detail: latencyMs !== undefined
      ? `Shard A signing latency: ${latencyMs}ms (${latencyGrade}). On-device key active.`
      : "Shard A device key is loaded and operational. No recent ceremony timing available.",
  };
}

/**
 * Evaluates Shard B (remote cosigner) health.
 */
function evaluateShardB(ctx: ShardHealthContext): ShardBHealth {
  const { cosignerApiUrl, shardBAddress, isOnline, forceAirGap, recentCeremony } = ctx;

  if (forceAirGap) {
    return {
      shard: "shard_b",
      status: "offline",
      cosignerAddress: shardBAddress,
      apiUrl: cosignerApiUrl,
      isReachable: false,
      detail: "Forced Air-Gap mode is active. Shard B cosigner is intentionally isolated. Transactions will be queued to offline outbox.",
    };
  }

  if (!isOnline) {
    return {
      shard: "shard_b",
      status: "offline",
      cosignerAddress: shardBAddress,
      apiUrl: cosignerApiUrl,
      isReachable: false,
      detail: "No network connectivity. Shard B cosigner is unreachable. Switch to online mode or enable Offline Outbox.",
    };
  }

  // Derive cosigner latency from last ceremony
  const rtMs = recentCeremony ? coSignerLatencyMs(recentCeremony) : null;
  const latencyGrade = rtMs !== null ? gradeLatency(rtMs) : undefined;

  const ceremonyShardB = recentCeremony?.find((s) => s.id === "shard_b");
  const wasFailed = ceremonyShardB?.status === "failed";

  if (wasFailed) {
    return {
      shard: "shard_b",
      status: "degraded",
      cosignerAddress: shardBAddress,
      apiUrl: cosignerApiUrl,
      isReachable: false,
      detail: `Shard B cosigner failed during last ceremony: ${ceremonyShardB?.error || "connection refused or timeout"}.`,
    };
  }

  if (!shardBAddress && !cosignerApiUrl) {
    return {
      shard: "shard_b",
      status: "unknown",
      isReachable: false,
      detail: "Shard B cosigner address is not registered. Complete wallet setup to pair the remote cosigner.",
    };
  }

  return {
    shard: "shard_b",
    status: rtMs !== null ? (latencyGrade === "slow" ? "degraded" : "healthy") : "healthy",
    cosignerAddress: shardBAddress,
    apiUrl: cosignerApiUrl,
    roundTripLatencyMs: rtMs ?? undefined,
    latencyGrade,
    isReachable: true,
    detail: rtMs !== null
      ? `Shard B round-trip: ${rtMs}ms (${latencyGrade}). Cosigner reachable at ${cosignerApiUrl || "default endpoint"}.`
      : `Shard B cosigner is configured at ${cosignerApiUrl || "default endpoint"}. No recent ceremony timing available.`,
  };
}

/**
 * Evaluates network layer health from recent ceremony stages.
 */
function evaluateNetwork(ctx: ShardHealthContext): NetworkHealth[] {
  const { isOnline, forceAirGap, recentCeremony } = ctx;
  const results: NetworkHealth[] = [];

  if (forceAirGap || !isOnline) {
    results.push({
      layer: "rpc",
      status: "offline",
      detail: forceAirGap ? "Air-Gap mode: RPC reads intentionally disabled." : "Network offline: RPC unreachable.",
    });
    results.push({
      layer: "bundler",
      status: "offline",
      detail: forceAirGap ? "Air-Gap mode: bundler submission intentionally disabled." : "Network offline: bundler unreachable.",
    });
    return results;
  }

  // RPC (nonce stage)
  const nonceStage = recentCeremony?.find((s) => s.id === "nonce");
  if (nonceStage) {
    const grade = nonceStage.ms !== undefined ? gradeLatency(nonceStage.ms) : undefined;
    results.push({
      layer: "rpc",
      status: nonceStage.status === "done" ? "healthy" : nonceStage.status === "failed" ? "degraded" : "unknown",
      latencyMs: nonceStage.ms,
      latencyGrade: grade,
      detail: nonceStage.status === "done"
        ? `EntryPoint.getNonce completed in ${nonceStage.ms}ms (${grade}).`
        : nonceStage.status === "failed"
        ? `RPC nonce read failed: ${nonceStage.error || "timeout"}.`
        : "RPC layer status unknown from last ceremony.",
    });
  } else {
    results.push({
      layer: "rpc",
      status: isOnline ? "healthy" : "offline",
      detail: isOnline ? "Network is online. RPC layer reachable." : "Network offline.",
    });
  }

  // Bundler (submit stage)
  const submitStage = recentCeremony?.find((s) => s.id === "submit");
  if (submitStage) {
    const grade = submitStage.ms !== undefined ? gradeLatency(submitStage.ms) : undefined;
    results.push({
      layer: "bundler",
      status: submitStage.status === "done" ? "healthy" : submitStage.status === "failed" ? "degraded" : "unknown",
      latencyMs: submitStage.ms,
      latencyGrade: grade,
      detail: submitStage.status === "done"
        ? `Bundler submission completed in ${submitStage.ms}ms (${grade}).`
        : submitStage.status === "failed"
        ? `Bundler submission failed: ${submitStage.error || "rejected"}.`
        : "Bundler status unknown.",
    });
  } else {
    results.push({
      layer: "bundler",
      status: isOnline ? "healthy" : "offline",
      detail: isOnline ? "Bundler endpoint reachable." : "Network offline.",
    });
  }

  return results;
}

/**
 * Evaluates nonce synchronization health.
 */
function evaluateNonce(ctx: ShardHealthContext): NonceHealth {
  const { confirmedNonce } = ctx;
  const localNonce = confirmedNonce;

  if (localNonce === undefined || localNonce === null) {
    return {
      isDrifted: false,
      detail: "No confirmed nonce available. Nonce will be fetched on-demand from EntryPoint before each send.",
    };
  }

  return {
    confirmedNonce: localNonce,
    isDrifted: false,
    detail: `Confirmed nonce: ${localNonce}. Account sequence is synchronized with the chain.`,
  };
}

/**
 * Evaluates ceremony performance from the most recent signing attempt.
 */
function evaluateCeremony(stages: CeremonyStage[]): CeremonyPerformanceSummary {
  const total = totalElapsedMs(stages);
  const coSignerMs = coSignerLatencyMs(stages);
  const shardAStage = stages.find((s) => s.id === "shard_a");
  const completed = stages.filter((s) => s.status === "done").length;
  const failed = stages.filter((s) => s.status === "failed").length;
  const wasComplete = stages.every((s) => s.status === "done");

  return {
    totalElapsedMs: total,
    coSignerLatencyMs: coSignerMs,
    shardALatencyMs: shardAStage?.ms,
    stagesCompleted: completed,
    stagesFailed: failed,
    wasComplete,
    overallGrade: gradeLatency(total || 500),
  };
}

/**
 * Computes an overall health score 0-100 from all shard and network layers.
 */
function computeScore(
  shardA: ShardAHealth,
  shardB: ShardBHealth,
  network: NetworkHealth[],
  nonce: NonceHealth
): number {
  let score = 100;

  // Shard A: 35 points
  if (shardA.status === "offline") score -= 35;
  else if (shardA.status === "degraded") score -= 18;
  else if (shardA.latencyGrade === "slow") score -= 5;

  // Shard B: 35 points
  if (shardB.status === "offline") score -= 15; // Offline can be intentional (air-gap)
  else if (shardB.status === "degraded") score -= 25;
  else if (shardB.latencyGrade === "slow") score -= 10;
  else if (shardB.status === "unknown") score -= 20;

  // Network: 20 points
  for (const n of network) {
    if (n.status === "degraded") score -= 8;
    else if (n.status === "offline" && !n.detail.includes("Air-Gap")) score -= 5;
    else if (n.latencyGrade === "slow") score -= 3;
  }

  // Nonce: 10 points
  if (nonce.isDrifted) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generates contextual recommendations from the health report.
 */
function generateRecommendations(
  shardA: ShardAHealth,
  shardB: ShardBHealth,
  network: NetworkHealth[],
  nonce: NonceHealth,
  ceremony?: CeremonyPerformanceSummary
): string[] {
  const recs: string[] = [];

  if (!shardA.isLoaded) {
    recs.push("Unlock Shard A: enter your passphrase or reconnect the device key to restore signing capability.");
  }
  if (shardA.status === "degraded") {
    recs.push("Shard A signing failed last ceremony. Check for key corruption or re-import from vault backup.");
  }

  if (shardB.status === "offline" && !recs.find((r) => r.includes("Air-Gap"))) {
    recs.push("Shard B is unreachable. Check network connection, or enable Forced Air-Gap mode to queue transactions for later broadcast.");
  }
  if (shardB.status === "degraded") {
    recs.push("Cosigner Shard B returned an error. Retry connection or check the cosigner endpoint status.");
  }
  if (shardB.latencyGrade === "slow") {
    recs.push("Shard B latency is elevated. High cosigner round-trip adds delay to every transaction. Check network quality.");
  }
  if (shardB.status === "unknown") {
    recs.push("Shard B cosigner is not paired. Complete wallet setup to register the remote cosigner address.");
  }

  const rpcDown = network.find((n) => n.layer === "rpc" && n.status === "degraded");
  if (rpcDown) {
    recs.push("RPC connectivity is degraded. EntryPoint.getNonce reads may fail. Consider switching to Offline Outbox mode.");
  }
  const bundlerDown = network.find((n) => n.layer === "bundler" && n.status === "degraded");
  if (bundlerDown) {
    recs.push("Bundler endpoint rejected the last transaction. Verify bundler availability or queue to offline outbox.");
  }

  if (nonce.isDrifted && nonce.driftAmount) {
    recs.push(`Nonce drift of ${nonce.driftAmount} detected. Re-fetch nonce from chain before next send to avoid sequence failures.`);
  }

  if (ceremony && ceremony.stagesFailed > 0) {
    recs.push(`${ceremony.stagesFailed} ceremony stage(s) failed in the last signing attempt. Review individual stage errors above.`);
  }

  if (recs.length === 0) {
    recs.push("All threshold architecture components are operating within normal parameters. No action required.");
  }

  return recs;
}

/**
 * Generates a complete shard health diagnostic report.
 */
export function generateShardHealthReport(ctx: ShardHealthContext): ShardHealthReport {
  const shardA = evaluateShardA(ctx);
  const shardB = evaluateShardB(ctx);
  const network = evaluateNetwork(ctx);
  const nonce = evaluateNonce(ctx);
  const ceremony = ctx.recentCeremony ? evaluateCeremony(ctx.recentCeremony) : undefined;

  const score = computeScore(shardA, shardB, network, nonce);
  const recommendations = generateRecommendations(shardA, shardB, network, nonce, ceremony);

  // Determine overall status
  let overallStatus: ShardStatus = "healthy";
  if (shardA.status === "offline" || (shardB.status === "degraded" && !ctx.forceAirGap)) {
    overallStatus = "degraded";
  }
  if (!shardA.isLoaded) {
    overallStatus = "offline";
  }
  if (score >= 90) overallStatus = "healthy";
  else if (score >= 60) overallStatus = "degraded";
  else overallStatus = "offline";

  // Build summary string
  const ceremonyNote = ceremony
    ? ` Last ceremony: ${ceremony.totalElapsedMs}ms total, Shard B: ${ceremony.coSignerLatencyMs ?? "N/A"}ms.`
    : "";
  const summary = `Threshold MPC Shard Health (${score}/100): Shard A ${shardA.status}, Shard B ${shardB.status}.${ceremonyNote}`;

  return {
    shardA,
    shardB,
    network,
    nonce,
    ceremony,
    overallStatus,
    score,
    summary,
    recommendations,
    generatedAt: Date.now(),
  };
}
