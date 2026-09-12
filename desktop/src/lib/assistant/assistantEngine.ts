import { sanitizePromptIngress } from "./redactionGateway";
import { parseDeterministicIntent } from "./deterministicParser";
import {
  explainTransferIntent,
  explainPaylinkIntent,
  explainFreezeIntent,
} from "./transactionExplainer";
import { smolLm2Engine } from "./wasmEngine";
import type { Contact } from "../contacts";
import {
  SpendingGuardrailConfig,
  SpendingRecord,
} from "../spendGuardrails";
import { evaluateSpend, estimateUsdValue } from "../spendGuardrails";
import {
  checkAddressPoisoning,
  type AddressGuardHistoryEntry,
} from "../addressGuard";
import type { AssistantMessage, EngineMode, ParsedIntent } from "./types";

export interface ProcessAssistantInputParams {
  input: string;
  walletAddress?: string;
  contacts?: Contact[];
  guardrailConfig?: SpendingGuardrailConfig;
  spendingHistory?: SpendingRecord[];
  transactionHistory?: { type: "send" | "receive"; counterparty: string; amount: string; asset: string }[];
  preferredEngine?: EngineMode;
}

/**
 * Master Assistant Processing Pipeline
 *
 * 1. Ingress Redaction Gateway (Blocks raw secrets)
 * 2. Deterministic Grammar & Slot-Filling Parser
 * 3. Evidence Gathering (Address Guard, Guardrails, Address Book)
 * 4. On-Device SmolLM2-135M Reasoning & Explanation Fallback
 */
export async function processAssistantQuery(
  params: ProcessAssistantInputParams
): Promise<AssistantMessage> {
  const {
    input,
    walletAddress = "",
    contacts = [],
    guardrailConfig,
    spendingHistory = [],
    transactionHistory = [],
    preferredEngine = "deterministic",
  } = params;

  // STEP 1: Ingress Redaction Gateway
  const redaction = sanitizePromptIngress(input);
  if (!redaction.allowed) {
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: `Security Alert: ${redaction.reason}`,
      timestamp: Date.now(),
      safetyEvidence: {
        poisonVerdict: "danger",
        intentSummary: "Prompt rejected by client-side secret redaction gateway.",
      },
    };
  }

  const cleanText = redaction.sanitized;

  // STEP 2: Deterministic NLP Parsing
  const parsed = parseDeterministicIntent(cleanText, contacts);

  if (parsed) {
    // 2A: Send Transfer Intent
    if (parsed.type === "send_transfer") {
      const historyEntries: AddressGuardHistoryEntry[] = transactionHistory.map((t) => ({
        type: t.type,
        counterparty: t.counterparty,
        amount: t.amount,
        asset: t.asset,
      }));

      const ownAddrs = [walletAddress, ...contacts.map((c) => c.address)].filter(Boolean);
      const poisonVerdict = checkAddressPoisoning({
        recipient: parsed.recipient,
        history: historyEntries,
        ownAddresses: ownAddrs,
      });

      const amountUsd = estimateUsdValue(parsed.amount, parsed.asset);
      const guardrailVerdict = guardrailConfig
        ? evaluateSpend(guardrailConfig, amountUsd, spendingHistory || [])
        : undefined;

      const matchedContact = contacts.find(
        (c) => c.address.toLowerCase() === parsed.recipient.toLowerCase()
      );

      const explanation = explainTransferIntent(parsed, {
        poisonVerdict,
        guardrailVerdict,
        matchedContact,
      });

      const lines = [
        explanation.summary,
        "",
        ...explanation.bulletPoints.map((b) => `* ${b}`),
        "",
        "Click below to review parameters and authorize with your device shard.",
      ];

      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: lines.join("\n"),
        timestamp: Date.now(),
        intent: parsed,
        safetyEvidence: {
          poisonVerdict: explanation.safetyState,
          poisonMessage: poisonVerdict.detail,
          guardrailVerdict: guardrailVerdict ? (guardrailVerdict.allowed ? "allowed" : "blocked") : undefined,
          guardrailMessage: guardrailVerdict?.message,
          contactMatch: matchedContact ? matchedContact.name : undefined,
          intentSummary: `Send ${parsed.amount} ${parsed.asset} to ${parsed.recipientName || parsed.recipient.slice(0, 8) + "..."}`,
        },
      };
    }

    // 2B: Pay Link Intent
    if (parsed.type === "create_paylink") {
      const explanation = explainPaylinkIntent(parsed);
      const lines = [
        explanation.summary,
        "",
        ...explanation.bulletPoints.map((b) => `* ${b}`),
        "",
        "Click below to generate this payment link on Robinhood Chain.",
      ];

      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: lines.join("\n"),
        timestamp: Date.now(),
        intent: parsed,
        safetyEvidence: {
          intentSummary: `Create ${parsed.amount} ${parsed.asset} Pay Link`,
        },
      };
    }

    // 2C: Panic Freeze Intent
    if (parsed.type === "panic_freeze") {
      const explanation = explainFreezeIntent(parsed);
      const lines = [
        explanation.summary,
        "",
        ...explanation.bulletPoints.map((b) => `* ${b}`),
        "",
        "Click below to execute panic freeze on the Co-Signer backend.",
      ];

      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: lines.join("\n"),
        timestamp: Date.now(),
        intent: parsed,
        safetyEvidence: {
          poisonVerdict: "warning",
          intentSummary: `Freeze Wallet (${parsed.hours ? `${parsed.hours}h` : "Permanent"})`,
        },
      };
    }

    // 2D: Unfreeze Intent
    if (parsed.type === "unfreeze_wallet") {
      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: parsed.code
          ? `Unfreeze request ready with authenticator code ${parsed.code}. Click below to unlock Shard B.`
          : "To lift the emergency freeze, you must enter the 6-digit code from your authenticator app.",
        timestamp: Date.now(),
        intent: parsed,
        safetyEvidence: {
          intentSummary: "Unlock Wallet",
        },
      };
    }

    // 2E: Check Address
    if (parsed.type === "check_address") {
      const historyEntries: AddressGuardHistoryEntry[] = transactionHistory.map((t) => ({
        type: t.type,
        counterparty: t.counterparty,
        amount: t.amount,
        asset: t.asset,
      }));
      const ownAddrs = [walletAddress, ...contacts.map((c) => c.address)].filter(Boolean);
      const verdict = checkAddressPoisoning({
        recipient: parsed.address,
        history: historyEntries,
        ownAddresses: ownAddrs,
      });

      const matchedContact = contacts.find(
        (c) => c.address.toLowerCase() === parsed.address.toLowerCase()
      );

      const status = verdict.level === "danger" ? "Danger" : verdict.level === "warning" ? "Warning" : "Clean";

      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: [
          `Address Inspection: ${parsed.address}`,
          `Status: ${status}`,
          `Verdict: ${verdict.detail}`,
          matchedContact ? `Known Contact: ${matchedContact.name} (${matchedContact.category})` : "Not present in local address book.",
        ].join("\n"),
        timestamp: Date.now(),
        intent: parsed,
        safetyEvidence: {
          poisonVerdict: verdict.level === "danger" ? "danger" : verdict.level === "warning" ? "warning" : "safe",
          poisonMessage: verdict.detail,
          contactMatch: matchedContact?.name,
        },
      };
    }

    // 2F: View Guardrails
    if (parsed.type === "view_guardrails") {
      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: guardrailConfig
          ? [
              "Spending Guardrails Status:",
              `Status: ${guardrailConfig.enabled ? "Active" : "Disabled"}`,
              `Single Transfer Cap: $${guardrailConfig.singleTxLimitUsd.toFixed(2)} USD`,
              `Daily 24h Spend Cap: $${guardrailConfig.dailyLimitUsd.toFixed(2)} USD`,
              `Strict Enforcement: ${guardrailConfig.strictMode ? "Enabled (Blocks violators)" : "Advisory (Prompts confirmation)"}`,
            ].join("\n")
          : "Spending guardrails are currently active on this device.",
        timestamp: Date.now(),
        intent: parsed,
      };
    }

    // 2G: View Contacts
    if (parsed.type === "view_contacts") {
      return {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          contacts.length === 0
            ? "Your private address book is currently empty. You can add contacts in the Contacts modal."
            : [
                `Address Book (${contacts.length} entries):`,
                ...contacts.slice(0, 8).map((c) => `* ${c.name}: ${c.address.slice(0, 6)}...${c.address.slice(-4)} (${c.category})`),
              ].join("\n"),
        timestamp: Date.now(),
        intent: parsed,
      };
    }
  }

  // STEP 3: Fallback to On-Device SmolLM2-135M Model for Conversational Reasoning
  if (preferredEngine === "smollm2_wasm" || smolLm2Engine.isReady()) {
    try {
      const systemPrompt =
        "You are Privatum Assistant, a transaction safety copilot for Robinhood Chain. Provide concise, factual answers about wallet safety, guardrails, address poisoning, and privacy. Never ask for or output secrets.";
      const answer = await smolLm2Engine.generate(cleanText, systemPrompt);
      if (answer && answer.trim().length > 0) {
        return {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: answer.trim(),
          timestamp: Date.now(),
        };
      }
    } catch (err) {
      console.warn("[assistantEngine] SmolLM2 inference failed, falling back to guide:", err);
    }
  }

  // STEP 4: Default Help & Guidance
  return {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: [
      "I am your on-device Privatum transaction safety copilot.",
      "",
      "You can ask me to parse transactions or check security facts:",
      "* 'Send 25 USDG to Alice' or 'Send 0.1 ETH to 0x... with stealth'",
      "* 'Create a pay link for 50 USDG'",
      "* 'Freeze wallet for 24 hours'",
      "* 'Check address 0x... for poisoning'",
      "* 'What are my spending limits?'",
      "",
      "In accordance with Privatum V2: I never touch keys, sign UserOps, or broadcast transactions without your manual approval.",
    ].join("\n"),
    timestamp: Date.now(),
  };
}
