/**
 * Local Natural Language Threshold MPC Ceremony & Shard Health Query Evaluator for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding:
 *   - Device key (Shard A) signing status and availability
 *   - Remote cosigner (Shard B) connectivity, round-trip latency, and pairing
 *   - 2-of-2 threshold MPC ceremony performance and stage timings
 *   - RPC and bundler infrastructure health during signing
 *
 * 100% client-side and deterministic: zero external telemetry.
 */

import {
  generateShardHealthReport,
  type ShardHealthContext,
  type ShardHealthReport,
} from "../shardHealth";
import type { ParsedShardHealthIntent } from "./types";

export interface ShardHealthQueryResult {
  handled: true;
  summary: string;
  details: string[];
  report: ShardHealthReport;
  intent: ParsedShardHealthIntent;
}

/**
 * Checks if input represents a threshold MPC ceremony or shard health inquiry.
 */
export function evaluateShardHealthQuery(
  input: string,
  context: ShardHealthContext = {}
): ShardHealthQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Pattern detection for shard, cosigner, MPC ceremony, and threshold signing queries
  const isShardQuery =
    /\b(?:shard\s+(?:health|status|diagnostic(?:s)?|report|check)|check\s+shard(?:s)?|diagnose\s+shard(?:s)?|shard\s+[ab]|check\s+shard\s+[ab]|test\s+shard\s+[ab]|is\s+shard\s+[ab]\s+(?:online|working|ready))\b/i.test(
      lower
    );

  const isCosignerQuery =
    /\b(?:cosigner\s+(?:health|status|diagnostic(?:s)?|connection|latency|check)|check\s+cosigner|test\s+cosigner|is\s+cosigner\s+(?:online|working|reachable)|cosigner\s+round-?trip)\b/i.test(
      lower
    );

  const isThresholdOrCeremonyQuery =
    /\b(?:threshold\s+(?:health|status|diagnostic(?:s)?|signing|performance|ceremony)|ceremony\s+(?:health|status|diagnostic(?:s)?|timing|performance|latency)|mpc\s+(?:health|status|diagnostic(?:s)?|ceremony)|signing\s+performance|how\s+fast\s+is\s+(?:my\s+)?(?:threshold\s+)?ceremony|diagnose\s+threshold)\b/i.test(
      lower
    );

  const isCompositeTrigger =
    (/\b(?:threshold|shard|cosigner|mpc\s+ceremony)\b/i.test(lower) &&
      /\b(?:health|status|diagnose|diagnostic(?:s)?|latency|test|ping|speed|report)\b/i.test(lower)) ||
    /\b(?:check\s+shard\s+b\s+connection|test\s+shard\s+b\s+connection|diagnose\s+threshold\s+signing\s+performance)\b/i.test(
      lower
    );

  if (!isShardQuery && !isCosignerQuery && !isThresholdOrCeremonyQuery && !isCompositeTrigger) {
    return null;
  }

  const report = generateShardHealthReport(context);

  const details: string[] = [
    `* Shard A (Device Key): ${report.shardA.status.toUpperCase()} - ${report.shardA.detail}`,
    `* Shard B (Remote Cosigner): ${report.shardB.status.toUpperCase()} - ${report.shardB.detail}`,
  ];

  if (report.ceremony) {
    const ceremonyNote = `* Last Ceremony: ${report.ceremony.totalElapsedMs}ms total (${report.ceremony.overallGrade}), ${report.ceremony.stagesCompleted} stages completed`;
    details.push(ceremonyNote);
  }

  for (const net of report.network) {
    details.push(`* ${net.layer.toUpperCase()}: ${net.status.toUpperCase()} - ${net.detail}`);
  }

  if (report.recommendations.length > 0) {
    details.push("");
    details.push("Recommendations:");
    for (const rec of report.recommendations) {
      details.push(`- ${rec}`);
    }
  }

  return {
    handled: true,
    summary: report.summary,
    details,
    report,
    intent: {
      type: "shard_health",
      report,
    },
  };
}
