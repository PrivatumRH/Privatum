/**
 * Local Natural Language Outbox & Transaction Queue Intelligence for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries regarding:
 * 1. Offline outbox status, queued transaction counts, and pending values.
 * 2. Next sequential offline nonces and collision protection.
 * 3. Diagnostic analysis of failed offline broadcasts with actionable remedies.
 * 4. Actionable broadcast and outbox management intents.
 *
 * 100% client-side and deterministic: operates over local state with zero external queries.
 */

import type { OfflineTransaction } from "../offlineOutbox";
import { getNextOfflineNonce } from "../offlineOutbox";
import type {
  ParsedBroadcastOutboxIntent,
  ParsedClearOutboxHistoryIntent,
  ParsedOutboxQueryIntent,
  ParsedViewOutboxIntent,
} from "./types";

export interface OutboxQueryContext {
  walletAddress?: string;
  offlineOutbox?: OfflineTransaction[];
  isOnline?: boolean;
  forceAirGap?: boolean;
  confirmedNonce?: number;
}

export interface OutboxQueryResult {
  handled: boolean;
  summary: string;
  details?: string[];
  queryType?:
    | "outbox_summary"
    | "next_nonce"
    | "failure_diagnostic"
    | "airgap_status";
  intent?:
    | ParsedBroadcastOutboxIntent
    | ParsedViewOutboxIntent
    | ParsedClearOutboxHistoryIntent
    | ParsedOutboxQueryIntent;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Analyzes error strings and provides automated root-cause remedies.
 */
function diagnoseFailureRemedy(errorStr: string): string {
  const lower = (errorStr || "").toLowerCase();
  if (lower.includes("insufficient funds") || lower.includes("want") || lower.includes("gas * price + value")) {
    return "Remedy: Fund your wallet with a small amount of ETH on Robinhood Chain (~0.00003 ETH) to cover execution gas reserve, or reduce the transfer amount.";
  }
  if (lower.includes("nonce too low") || lower.includes("nonce gap") || lower.includes("replacement transaction underpriced")) {
    return "Remedy: An external transaction moved your onchain nonce forward. Delete this item from the Outbox and re-sign with the current confirmed nonce.";
  }
  if (lower.includes("execution reverted")) {
    return "Remedy: Smart contract call reverted. Confirm the recipient address accepts tokens and token balance is sufficient.";
  }
  return "Remedy: Verify your internet connectivity and Robinhood Chain RPC status, then retry broadcast from the Outbox modal.";
}

/**
 * Parses and evaluates natural language outbox and queue inquiries.
 */
export function evaluateOutboxQuery(
  input: string,
  context: OutboxQueryContext
): OutboxQueryResult | null {
  const clean = input.trim().toLowerCase();
  const {
    walletAddress = "",
    offlineOutbox = [],
    isOnline = true,
    forceAirGap = false,
    confirmedNonce = 0,
  } = context;

  const queued = offlineOutbox.filter((t) => t.status === "queued");
  const failed = offlineOutbox.filter((t) => t.status === "failed");
  const broadcasted = offlineOutbox.filter((t) => t.status === "broadcasted");

  // 1. Actionable intent: Broadcast Outbox
  // e.g. "broadcast outbox", "broadcast my queued transfers", "relay outbox", "settle queued transactions"
  if (
    /(?:broadcast|relay|settle|send\s+all)\s+(?:my\s+)?(?:all\s+)?(?:offline\s+)?(?:queued\s+)?(?:outbox|transfers?|transactions?|queue)/i.test(
      clean
    ) ||
    clean === "broadcast outbox" ||
    clean === "relay outbox"
  ) {
    if (queued.length === 0) {
      return {
        handled: true,
        summary: "Your Offline Outbox is clear. There are no queued transfers awaiting broadcast.",
        details: [
          `Broadcasted History: ${broadcasted.length} transfer(s)`,
          `Failed Items: ${failed.length}`,
          "To stage an offline transfer, enable Air-Gap Mode in the Send modal.",
        ],
      };
    }

    const totalEth = queued
      .filter((t) => t.asset === "ETH")
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalUsdg = queued
      .filter((t) => t.asset === "USDG")
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const valueStrs: string[] = [];
    if (totalEth > 0) valueStrs.push(`${totalEth.toFixed(4)} ETH`);
    if (totalUsdg > 0) valueStrs.push(`${totalUsdg.toFixed(2)} USDG`);
    const valueSummary = valueStrs.length > 0 ? valueStrs.join(" + ") : "0";

    const isReadyToRelay = isOnline && !forceAirGap;
    const lines = [
      `Found ${queued.length} queued transfer${queued.length === 1 ? "" : "s"} (${valueSummary}) ready for onchain settlement.`,
      "",
      ...queued.map(
        (t) =>
          `* Nonce #${t.nonce}: ${t.amount} ${t.asset} to ${shortenAddr(t.recipient)}${t.recipientLabel ? ` (${t.recipientLabel})` : ""}`
      ),
      "",
      isReadyToRelay
        ? "Network connection is active. Review the batch below and click Broadcast Queued Transfers to execute."
        : "Note: Forced Air-Gap mode is currently active. Disable Air-Gap mode before broadcasting.",
    ];

    return {
      handled: true,
      summary: lines.join("\n"),
      intent: {
        type: "broadcast_outbox",
        queuedCount: queued.length,
      },
    };
  }

  // 2. Actionable intent: View / Open Outbox
  // e.g. "open outbox", "view outbox", "show my offline queue"
  if (
    /(?:open|view|show|check|inspect)\s+(?:my\s+)?(?:offline\s+)?(?:outbox|queue)/i.test(
      clean
    )
  ) {
    return {
      handled: true,
      summary: `Opening your Offline Outbox. Currently tracking ${queued.length} queued, ${broadcasted.length} broadcasted, and ${failed.length} failed transaction(s).`,
      intent: {
        type: "view_outbox",
      },
    };
  }

  // 3. Actionable intent: Clear Outbox History
  // e.g. "clear outbox history", "clean finished outbox items"
  if (
    /(?:clear|clean|empty|purge|reset)\s+(?:my\s+)?(?:completed\s+|finished\s+|failed\s+)?(?:offline\s+)?(?:outbox\s+history|outbox)/i.test(
      clean
    )
  ) {
    const finishedCount = broadcasted.length + failed.length;
    return {
      handled: true,
      summary:
        finishedCount > 0
          ? `Found ${finishedCount} completed or failed transaction(s) eligible for clearing. Queued transfers will be preserved.`
          : "Your outbox history is already clean.",
      intent: {
        type: "clear_outbox_history",
      },
    };
  }

  // 4. Failure Diagnostics & Automated Remedies
  // e.g. "why did my broadcast fail?", "any failed transfers in outbox?", "why did my transaction fail?"
  if (
    /(?:why\s+did\s+(?:my\s+)?(?:broadcast|outbox|transfer|transaction)\s+fail|failed\s+(?:offline\s+)?(?:transfers?|transactions?|outbox)|failure\s+in\s+outbox|diagnostic)/i.test(
      clean
    )
  ) {
    if (failed.length === 0) {
      return {
        handled: true,
        queryType: "failure_diagnostic",
        summary: "No failed transfers found in your offline outbox. All staged transfers are healthy.",
        details: [
          `Currently Queued: ${queued.length}`,
          `Successfully Broadcasted: ${broadcasted.length}`,
        ],
      };
    }

    const details: string[] = [];
    for (const f of failed) {
      const errReason = f.error || "Unknown RPC error";
      const remedy = diagnoseFailureRemedy(errReason);
      details.push(`Nonce #${f.nonce} (${f.amount} ${f.asset} to ${shortenAddr(f.recipient)}):`);
      details.push(`  Error: ${errReason}`);
      details.push(`  ${remedy}`);
    }

    return {
      handled: true,
      queryType: "failure_diagnostic",
      summary: `Found ${failed.length} failed offline transfer${failed.length === 1 ? "" : "s"} in your outbox. Root-cause diagnostic and recommendations below:`,
      details,
    };
  }

  // 5. Next Sequential Nonce Check
  // e.g. "what is my next nonce?", "next offline nonce", "what nonce will be used?"
  if (
    /(?:what\s+is\s+(?:my\s+)?(?:next\s+)?(?:offline\s+)?nonce|next\s+nonce|outbox\s+nonce)/i.test(
      clean
    )
  ) {
    const nextNonce = getNextOfflineNonce(walletAddress, confirmedNonce);
    return {
      handled: true,
      queryType: "next_nonce",
      summary: `Your next offline transfer will be assigned Nonce #${nextNonce}.`,
      details: [
        `Confirmed Onchain Base Nonce: #${confirmedNonce}`,
        `Queued Outbox Transfers: ${queued.length}`,
        `Highest Queued Nonce: ${queued.length > 0 ? `#${Math.max(...queued.map((t) => t.nonce))}` : "None"}`,
        "Deterministic sequential nonces guarantee transactions execute strictly in order without collisions.",
      ],
    };
  }

  // 6. Air-Gap / Connectivity Status
  // e.g. "is air gap active?", "am i offline?", "airgap status"
  if (
    /(?:is\s+air[- ]?gap\s+(?:mode\s+)?active|am\s+i\s+offline|connectivity\s+status|air[- ]?gap\s+status)/i.test(
      clean
    )
  ) {
    return {
      handled: true,
      queryType: "airgap_status",
      summary: forceAirGap
        ? "Forced Air-Gap Mode is ACTIVE: All transfers drafted in the Send modal are signed locally with device Shard A and staged in your Offline Outbox without contacting RPC."
        : isOnline
        ? "Network connection is ONLINE: Transfers execute directly on Robinhood Chain unless Forced Air-Gap mode is enabled in the Outbox modal."
        : "Network connection is OFFLINE: Automatic fallback to local Shard A offline signing is currently active.",
      details: [
        `Physical Network: ${isOnline ? "Connected" : "Disconnected"}`,
        `Air-Gap Override: ${forceAirGap ? "Enabled" : "Disabled"}`,
        `Queued Transfers: ${queued.length}`,
      ],
    };
  }

  // 7. General Outbox Summary / Queue Overview
  // e.g. "what is in my outbox?", "how many transfers are queued?", "outbox status", "show outbox summary"
  if (
    /(?:what\s+(?:is|are)\s+in\s+(?:my\s+)?(?:offline\s+)?outbox|how\s+many\s+(?:transfers?|transactions?|txs?)\s+(?:are\s+)?(?:queued|in\s+(?:my\s+)?outbox)|outbox\s+status|check\s+(?:my\s+)?outbox)/i.test(
      clean
    )
  ) {
    if (offlineOutbox.length === 0) {
      return {
        handled: true,
        queryType: "outbox_summary",
        summary: "Your Offline Outbox is completely empty. No offline or air-gapped transfers are staged.",
        details: [
          "Transfers initiated while offline or in Air-Gap mode will be signed and held here.",
          `Next Nonce: #${confirmedNonce}`,
        ],
      };
    }

    const details: string[] = [
      `Queued for Settlement: ${queued.length}`,
      `Successfully Broadcasted: ${broadcasted.length}`,
      `Failed / Errored: ${failed.length}`,
    ];

    if (queued.length > 0) {
      details.push("Pending transfers in queue:");
      for (const t of queued) {
        details.push(
          `* Nonce #${t.nonce}: ${t.amount} ${t.asset} to ${shortenAddr(t.recipient)}${t.recipientLabel ? ` (${t.recipientLabel})` : ""}`
        );
      }
    }

    return {
      handled: true,
      queryType: "outbox_summary",
      summary: `Offline Outbox contains ${queued.length} queued transfer${queued.length === 1 ? "" : "s"} (${offlineOutbox.length} total entries tracked).`,
      details,
    };
  }

  return null;
}
