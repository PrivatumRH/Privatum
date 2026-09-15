import type { AddressGuardVerdict } from "./addressGuard";
import type { GuardrailVerdict } from "./spendGuardrails";
import type { Contact } from "./contacts";
import type { BlacklistVerdict } from "./transferBlacklist";

export type RiskLevel = "low" | "medium" | "high";

export interface RiskFactor {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  description: string;
}

export interface TransactionRiskAssessment {
  score: number;
  level: RiskLevel;
  label: string;
  color: string;
  summary: string;
  factors: RiskFactor[];
}

export interface EvaluateRiskParams {
  recipient: string;
  addressVerdict?: AddressGuardVerdict | { level: string; lookalikeOf?: string; detail?: string } | null;
  guardrailVerdict?: GuardrailVerdict | { allowed: boolean; warning?: boolean; message?: string } | null;
  blacklistVerdict?: BlacklistVerdict | { isBlacklisted: boolean; entry?: { name?: string; reason?: string; category?: string } } | null;
  contacts?: (Contact | { address: string })[];
  transactions?: { type: "send" | "receive"; counterparty: string }[];
  simulationReverted?: boolean;
  isStealth?: boolean;
}

export function evaluateTransactionRisk(params: EvaluateRiskParams): TransactionRiskAssessment {
  const {
    recipient,
    addressVerdict,
    guardrailVerdict,
    blacklistVerdict,
    contacts = [],
    transactions = [],
    simulationReverted = false,
    isStealth = false,
  } = params;

  let score = 0;
  const factors: RiskFactor[] = [];
  const lowerRecipient = (recipient || "").toLowerCase().trim();

  // 0. Transfer Blacklist & Threat Feed Interception (Hard Stop)
  if (blacklistVerdict?.isBlacklisted) {
    const cat = blacklistVerdict.entry?.category || "Malicious";
    const reason = blacklistVerdict.entry?.reason || "Blacklisted counterparty";
    const name = blacklistVerdict.entry?.name ? ` (${blacklistVerdict.entry.name})` : "";
    factors.push({
      id: "transfer_blacklist",
      name: "Transfer Blacklist",
      status: "fail",
      description: `Critical threat detected: destination is blacklisted under ${cat}${name}. Reason: ${reason}.`,
    });
    return {
      score: 100,
      level: "high",
      label: "Critical Risk (Blacklisted)",
      color: "#f64943",
      summary: `Transfer is strictly blocked. Recipient matches an active threat entry: ${cat} - ${reason}.`,
      factors,
    };
  }

  // 1. Recipient History Check
  const isKnownContact = contacts.some((c) => c.address.toLowerCase() === lowerRecipient);
  const isPreviousRecipient = transactions.some(
    (t) => t.type === "send" && t.counterparty.toLowerCase() === lowerRecipient
  );

  if (isKnownContact) {
    score = Math.max(0, score - 5);
    factors.push({
      id: "recipient_history",
      name: "Recipient History",
      status: "pass",
      description: "Verified contact in local address book.",
    });
  } else if (isPreviousRecipient) {
    factors.push({
      id: "recipient_history",
      name: "Recipient History",
      status: "pass",
      description: "Previously confirmed counterparty in transaction history.",
    });
  } else if (isStealth) {
    factors.push({
      id: "recipient_history",
      name: "Stealth Address",
      status: "pass",
      description: "Fresh one-time stealth address generated for this transfer.",
    });
  } else {
    score += 15;
    factors.push({
      id: "recipient_history",
      name: "Recipient History",
      status: "warn",
      description: "First-time recipient. No prior transfer history found.",
    });
  }

  // 2. Address Poisoning Screening
  if (addressVerdict) {
    if (addressVerdict.level === "danger") {
      score += 50;
      factors.push({
        id: "address_guard",
        name: "Address Guard",
        status: "fail",
        description: `Look-alike collision detected with ${addressVerdict.lookalikeOf ? addressVerdict.lookalikeOf.slice(0, 8) + "..." : "known counterparty"}.`,
      });
    } else if (addressVerdict.level === "warning") {
      score += 25;
      factors.push({
        id: "address_guard",
        name: "Address Guard",
        status: "warn",
        description: "Notice: Unrecognized address profile.",
      });
    } else {
      factors.push({
        id: "address_guard",
        name: "Address Guard",
        status: "pass",
        description: "No address look-alike collision detected.",
      });
    }
  } else {
    factors.push({
      id: "address_guard",
      name: "Address Guard",
      status: "pass",
      description: "Address screening clear.",
    });
  }

  // 3. Spending Guardrails
  if (guardrailVerdict) {
    if (!guardrailVerdict.allowed) {
      score += 40;
      factors.push({
        id: "guardrails",
        name: "Spending Guardrails",
        status: "fail",
        description: `Limit breached: ${guardrailVerdict.message}`,
      });
    } else if (guardrailVerdict.warning) {
      score += 20;
      factors.push({
        id: "guardrails",
        name: "Spending Guardrails",
        status: "warn",
        description: `Notice: ${guardrailVerdict.message}`,
      });
    } else {
      factors.push({
        id: "guardrails",
        name: "Spending Guardrails",
        status: "pass",
        description: "Transfer is within single and daily spend caps.",
      });
    }
  } else {
    factors.push({
      id: "guardrails",
      name: "Spending Guardrails",
      status: "pass",
      description: "Within policy limits.",
    });
  }

  // 4. Contract Simulation
  if (simulationReverted) {
    score += 35;
    factors.push({
      id: "simulation",
      name: "Execution Simulation",
      status: "fail",
      description: "Simulation reverted on Robinhood Chain node.",
    });
  } else {
    factors.push({
      id: "simulation",
      name: "Execution Simulation",
      status: "pass",
      description: "Simulation passed with zero reverts detected.",
    });
  }

  let level: RiskLevel = "low";
  let label = "Low Risk";
  let color = "#22c55e"; // Emerald green
  let summary = "Standard transaction parameters verified across all safety gates.";

  if (score >= 50) {
    level = "high";
    label = "High Risk";
    color = "#f64943"; // Privatum red
    summary = "High risk factor detected. Verify all characters before proceeding.";
  } else if (score >= 25) {
    level = "medium";
    label = "Medium Risk";
    color = "#f59e0b"; // Amber
    summary = "First-time counterparty or guardrail threshold approached.";
  }

  return {
    score,
    level,
    label,
    color,
    summary,
    factors,
  };
}
