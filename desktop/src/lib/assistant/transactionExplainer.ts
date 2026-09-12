import type { AddressGuardVerdict } from "../addressGuard";
import type { GuardrailVerdict } from "../spendGuardrails";
import type { Contact } from "../contacts";
import type { ParsedTransferIntent, ParsedPaylinkIntent, ParsedFreezeIntent } from "./types";

/**
 * Transaction Explainer
 *
 * Grounded in the Privatum V2 Privacy & AI Strategy Brief.
 * Translates verified deterministic evidence into clear, unambiguous prose.
 * Always cites evidence provenance and highlights uncertainties.
 */
export function explainTransferIntent(
  intent: ParsedTransferIntent,
  evidence: {
    poisonVerdict?: AddressGuardVerdict;
    guardrailVerdict?: GuardrailVerdict;
    matchedContact?: Contact | null;
  }
): {
  summary: string;
  bulletPoints: string[];
  safetyState: "safe" | "warning" | "danger";
} {
  const bulletPoints: string[] = [];
  let safetyState: "safe" | "warning" | "danger" = "safe";

  // 1. Recipient & Contact check
  if (evidence.matchedContact) {
    bulletPoints.push(`Recipient matched in private address book: ${evidence.matchedContact.name}`);
  } else {
    bulletPoints.push(`Recipient is a new address (${intent.recipient.slice(0, 6)}...${intent.recipient.slice(-4)})`);
  }

  // 2. Poisoning check
  if (evidence.poisonVerdict) {
    if (evidence.poisonVerdict.level === "danger") {
      safetyState = "danger";
      const target = evidence.poisonVerdict.lookalikeOf
        ? `(${evidence.poisonVerdict.lookalikeOf.slice(0, 8)}...)`
        : "";
      bulletPoints.push(
        `Address Poisoning Alert: Shares prefix/suffix with a known counterparty ${target}. Check every character.`
      );
    } else if (evidence.poisonVerdict.level === "warning") {
      safetyState = "warning";
      bulletPoints.push(
        "Poisoning Warning: Unrecognized counterparty with similar character profile."
      );
    } else {
      bulletPoints.push("Address Poisoning Guard: No look-alike collision detected.");
    }
  }

  // 3. Guardrail check
  if (evidence.guardrailVerdict) {
    if (!evidence.guardrailVerdict.allowed) {
      safetyState = "danger";
      bulletPoints.push(`Spending Limit Breached: ${evidence.guardrailVerdict.message}`);
    } else if (evidence.guardrailVerdict.warning) {
      if (safetyState !== "danger") safetyState = "warning";
      bulletPoints.push(`Guardrail Notice: ${evidence.guardrailVerdict.message}`);
    } else {
      bulletPoints.push("Spending Guardrail: Within 24-hour limit.");
    }
  }

  // 4. Mode
  if (intent.isStealth) {
    bulletPoints.push("Stealth Transfer: Generates an unlinked single-use address for recipient anonymity.");
  } else {
    bulletPoints.push("Direct Transfer: Transaction visible on Robinhood Chain explorer.");
  }

  const summary = `Proposed transfer of ${intent.amount} ${intent.asset} to ${
    intent.recipientName ? `${intent.recipientName} (${intent.recipient.slice(0, 6)}...)` : intent.recipient
  }.`;

  return {
    summary,
    bulletPoints,
    safetyState,
  };
}

export function explainPaylinkIntent(intent: ParsedPaylinkIntent): {
  summary: string;
  bulletPoints: string[];
} {
  return {
    summary: `Generate single-use payment link for ${intent.amount} ${intent.asset}.`,
    bulletPoints: [
      "Backend generates an ephemeral burner deposit address on Robinhood Chain.",
      "Payer sends funds to burner; co-signer automatically sweeps directly into your smart account.",
      "Sender never learns your real smart account address.",
      intent.memo ? `Memo attached: "${intent.memo}"` : "No public memo attached.",
    ],
  };
}

export function explainFreezeIntent(intent: ParsedFreezeIntent): {
  summary: string;
  bulletPoints: string[];
} {
  const durationText =
    intent.hours === null
      ? "until manually unlocked with recovery key"
      : `for ${intent.hours} hour${intent.hours > 1 ? "s" : ""}`;

  return {
    summary: `Emergency panic freeze on Robinhood Chain (${durationText}).`,
    bulletPoints: [
      "Co-Signer immediately locks Shard B against all outgoing transfer requests.",
      "Cannot be bypassed by compromised local device key alone (2-of-3 threshold protection).",
      "Unfreezing requires entering the 6-digit authenticator code from your recovery device.",
    ],
  };
}
