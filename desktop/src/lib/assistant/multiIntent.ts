/**
 * Multi-Intent Command Chaining Parser for PRIVATUM Assistant.
 *
 * Decomposes compound natural language prompts joined by sequential or
 * coordinate connectors ("then", "and then", "and", ";") into an ordered
 * array of actionable transaction and security intents.
 */

import type { Contact } from "../contacts";
import type { ParsedIntent, ParsedTransferIntent, ParsedPaylinkIntent } from "./types";
import { parseDeterministicIntent } from "./deterministicParser";

export interface ChainedIntentStep {
  intent: ParsedIntent;
  stepIndex: number;
  label: string;
  summary: string;
}

export interface MultiIntentPlan {
  steps: ChainedIntentStep[];
  rawClauses: string[];
}

/**
 * Splits a compound input string into candidate command clauses.
 */
export function splitCompoundPrompt(input: string): string[] {
  // Normalize whitespace
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Split on delimiters: semicolons, "then", "and then", "also", or "and" followed by an action verb
  // Note: we avoid splitting "and" when it's part of a phrase like "bread and butter" or "Alice and Bob",
  // so we look for "and" followed by action verbs (send, transfer, pay, create, make, freeze, check, lock).
  const clauses: string[] = [];

  // First split by semicolon or "then"
  const rawParts = trimmed.split(/\s*(?:;\s*|\band\s+then\b|\bthen\b|\balso\b)\s*/i);

  for (const part of rawParts) {
    // If a part still contains "and" followed by an imperative verb, split it further
    const subParts = part.split(/\s+\band\s+(?=(?:send|transfer|pay|create|make|freeze|lock|unfreeze|check|inspect|swap)\b)/i);
    for (const sub of subParts) {
      const cleanSub = sub.trim();
      if (cleanSub.length > 0) {
        clauses.push(cleanSub);
      }
    }
  }

  return clauses;
}

/**
 * Generates a concise human-readable label and summary for a single parsed intent.
 */
export function summarizeIntentStep(intent: ParsedIntent, stepIndex: number): { label: string; summary: string } {
  switch (intent.type) {
    case "send_transfer": {
      const target = intent.recipientName || `${intent.recipient.slice(0, 6)}...${intent.recipient.slice(-4)}`;
      return {
        label: `Step ${stepIndex + 1}: Send Transfer`,
        summary: `Send ${intent.amount} ${intent.asset} to ${target}${intent.isStealth ? " (Stealth)" : ""}`,
      };
    }
    case "create_paylink":
      return {
        label: `Step ${stepIndex + 1}: Create Pay Link`,
        summary: `Generate ${intent.amount} ${intent.asset} payment link${intent.memo ? ` (${intent.memo})` : ""}`,
      };
    case "rwa_command":
      return {
        label: `Step ${stepIndex + 1}: RWA Trade`,
        summary: `${intent.action} ${intent.amount} ${intent.tokenSymbol} using ${intent.fundingAsset}`,
      };
    case "portfolio_intelligence":
      return {
        label: `Step ${stepIndex + 1}: Portfolio Intelligence`,
        summary: "Analyze local holdings, allocation, and concentration",
      };
    case "treasury_automation":
      return {
        label: `Step ${stepIndex + 1}: Treasury Automation`,
        summary: intent.plan.summary,
      };
    case "panic_freeze":
      return {
        label: `Step ${stepIndex + 1}: Panic Freeze`,
        summary: `Lock wallet cosigner${intent.hours ? ` for ${intent.hours} hour(s)` : " indefinitely"}`,
      };
    case "unfreeze_wallet":
      return {
        label: `Step ${stepIndex + 1}: Unlock Wallet`,
        summary: `Lift freeze with 2FA authorization code`,
      };
    case "check_address":
      return {
        label: `Step ${stepIndex + 1}: Inspect Address`,
        summary: `Verify security status of ${intent.address.slice(0, 8)}...`,
      };
    case "view_guardrails":
      return {
        label: `Step ${stepIndex + 1}: View Guardrails`,
        summary: `Check 24-hour spending budget limits`,
      };
    case "view_contacts":
      return {
        label: `Step ${stepIndex + 1}: View Contacts`,
        summary: `List address book entries`,
      };
    default:
      return {
        label: `Step ${stepIndex + 1}: Command`,
        summary: "Execute requested action",
      };
  }
}

/**
 * Decomposes a multi-step user prompt into an ordered MultiIntentPlan.
 * Returns null if fewer than 2 distinct actionable intents are detected.
 */
export function parseMultiIntent(
  input: string,
  contacts: Contact[] = []
): MultiIntentPlan | null {
  const clauses = splitCompoundPrompt(input);
  if (clauses.length < 2) return null;

  const validSteps: ChainedIntentStep[] = [];

  for (const clause of clauses) {
    const parsed = parseDeterministicIntent(clause, contacts);
    if (parsed && parsed.type !== "general_query") {
      const stepIndex = validSteps.length;
      const { label, summary } = summarizeIntentStep(parsed, stepIndex);
      validSteps.push({
        intent: parsed,
        stepIndex,
        label,
        summary,
      });
    }
  }

  // Must have at least 2 distinct actionable intents to qualify as a chained plan
  if (validSteps.length < 2) return null;

  return {
    steps: validSteps,
    rawClauses: clauses,
  };
}
