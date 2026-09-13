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
import { generateInferenceReceipt } from "./inferenceReceipt";

import { evaluateLedgerQuery } from "./ledgerQueries";
import { parseMultiIntent } from "./multiIntent";

export interface ProcessAssistantInputParams {
  input: string;
  walletAddress?: string;
  contacts?: Contact[];
  guardrailConfig?: SpendingGuardrailConfig;
  spendingHistory?: SpendingRecord[];
  transactionHistory?: { type: "send" | "receive"; counterparty: string; amount: string; asset: string; timestamp?: number; hash?: string }[];
  preferredEngine?: EngineMode;
  onToken?: (token: string) => void;
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
    const alertContent = `Security Alert: ${redaction.reason}`;
    // Hash the redaction placeholder, never the raw prompt: the input that
    // triggered this branch IS the secret, and a receipt must never commit to it.
    const alertReceipt = await generateInferenceReceipt(
      redaction.sanitized,
      alertContent,
      "deterministic"
    );
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: alertContent,
      timestamp: Date.now(),
      inferenceReceipt: alertReceipt,
      transcript: { input: redaction.sanitized, output: alertContent },
      safetyEvidence: {
        poisonVerdict: "danger",
        intentSummary: "Prompt rejected by client-side secret redaction gateway.",
      },
    };
  }

  const cleanText = redaction.sanitized;

  const createResponse = async (
    content: string,
    options?: {
      intent?: ParsedIntent;
      safetyEvidence?: AssistantMessage["safetyEvidence"];
      engine?: "deterministic" | "smollm2_wasm";
    }
  ): Promise<AssistantMessage> => {
    const engineMode = options?.engine || (preferredEngine === "smollm2_wasm" ? "smollm2_wasm" : "deterministic");
    const inferenceReceipt = await generateInferenceReceipt(cleanText, content, engineMode);
    return {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content,
      timestamp: Date.now(),
      intent: options?.intent,
      safetyEvidence: options?.safetyEvidence,
      inferenceReceipt,
      transcript: { input: cleanText, output: content },
    };
  };

  // STEP 2: Multi-Intent Command Chaining (Compound Instructions)
  const multiPlan = parseMultiIntent(cleanText, contacts);
  if (multiPlan) {
    const lines = [
      `Multi-Step Execution Plan (${multiPlan.steps.length} actions):`,
      "",
      ...multiPlan.steps.map((s) => `* ${s.label}: ${s.summary}`),
      "",
      "Click below to review each action and execute with your local shard.",
    ];

    return await createResponse(lines.join("\n"), {
      intent: {
        type: "multi_intent_plan",
        steps: multiPlan.steps,
      },
      safetyEvidence: {
        intentSummary: `Chained Execution (${multiPlan.steps.length} steps)`,
      },
    });
  }

  // STEP 3: Local Natural Language Ledger Queries
  const ledgerRes = evaluateLedgerQuery(cleanText, {
    walletAddress,
    contacts,
    guardrailConfig,
    spendingHistory,
    transactionHistory,
  });

  if (ledgerRes && ledgerRes.handled) {
    const lines = [ledgerRes.summary];
    if (ledgerRes.details && ledgerRes.details.length > 0) {
      lines.push("");
      for (const d of ledgerRes.details) {
        lines.push(`* ${d}`);
      }
    }

    return await createResponse(lines.join("\n"), {
      intent: {
        type: "ledger_query",
        queryType: ledgerRes.queryType,
        summary: ledgerRes.summary,
        details: ledgerRes.details,
      },
      safetyEvidence: {
        intentSummary: `Ledger Query: ${ledgerRes.queryType || "inquiry"}`,
      },
    });
  }

  // STEP 4: Deterministic NLP Parsing
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

      return await createResponse(lines.join("\n"), {
        intent: parsed,
        safetyEvidence: {
          poisonVerdict: explanation.safetyState,
          poisonMessage: poisonVerdict.detail,
          guardrailVerdict: guardrailVerdict ? (guardrailVerdict.allowed ? "allowed" : "blocked") : undefined,
          guardrailMessage: guardrailVerdict?.message,
          contactMatch: matchedContact ? matchedContact.name : undefined,
          intentSummary: `Send ${parsed.amount} ${parsed.asset} to ${parsed.recipientName || parsed.recipient.slice(0, 8) + "..."}`,
        },
      });
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

      return await createResponse(lines.join("\n"), {
        intent: parsed,
        safetyEvidence: {
          intentSummary: `Create ${parsed.amount} ${parsed.asset} Pay Link`,
        },
      });
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

      return await createResponse(lines.join("\n"), {
        intent: parsed,
        safetyEvidence: {
          poisonVerdict: "warning",
          intentSummary: `Freeze Wallet (${parsed.hours ? `${parsed.hours}h` : "Permanent"})`,
        },
      });
    }

    // 2D: Unfreeze Intent
    if (parsed.type === "unfreeze_wallet") {
      return await createResponse(
        parsed.code
          ? `Unfreeze request ready with authenticator code ${parsed.code}. Click below to unlock Shard B.`
          : "To lift the emergency freeze, you must enter the 6-digit code from your authenticator app.",
        {
          intent: parsed,
          safetyEvidence: {
            intentSummary: "Unlock Wallet",
          },
        }
      );
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

      return await createResponse(
        [
          `Address Inspection: ${parsed.address}`,
          `Status: ${status}`,
          `Verdict: ${verdict.detail}`,
          matchedContact ? `Known Contact: ${matchedContact.name} (${matchedContact.category})` : "Not present in local address book.",
        ].join("\n"),
        {
          intent: parsed,
          safetyEvidence: {
            poisonVerdict: verdict.level === "danger" ? "danger" : verdict.level === "warning" ? "warning" : "safe",
            poisonMessage: verdict.detail,
            contactMatch: matchedContact?.name,
          },
        }
      );
    }

    // 2F: View Guardrails
    if (parsed.type === "view_guardrails") {
      return await createResponse(
        guardrailConfig
          ? [
              "Spending Guardrails Status:",
              `Status: ${guardrailConfig.enabled ? "Active" : "Disabled"}`,
              `Single Transfer Cap: $${guardrailConfig.singleTxLimitUsd.toFixed(2)} USD`,
              `Daily 24h Spend Cap: $${guardrailConfig.dailyLimitUsd.toFixed(2)} USD`,
              `Strict Enforcement: ${guardrailConfig.strictMode ? "Enabled (Blocks violators)" : "Advisory (Prompts confirmation)"}`,
            ].join("\n")
          : "Spending guardrails are currently active on this device.",
        { intent: parsed }
      );
    }

    // 2G: View Contacts
    if (parsed.type === "view_contacts") {
      return await createResponse(
        contacts.length === 0
          ? "Your private address book is currently empty. You can add contacts in the Contacts modal."
          : [
              `Address Book (${contacts.length} entries):`,
              ...contacts.slice(0, 8).map((c) => `* ${c.name}: ${c.address.slice(0, 6)}...${c.address.slice(-4)} (${c.category})`),
            ].join("\n"),
        { intent: parsed }
      );
    }
  }

  // STEP 3: On-Device AI Execution (SmolLM2-135M via WebAssembly / ONNX)
  if (preferredEngine === "smollm2_wasm" || smolLm2Engine.isReady()) {
    if (!smolLm2Engine.isReady()) {
      // Trigger initialization in background if not already started
      smolLm2Engine.init().catch((err) => console.warn("[assistantEngine] smolLm2Engine init err:", err));
      const status = smolLm2Engine.getStatus();
      if (status.status === "downloading") {
        return await createResponse(
          `AI model is currently downloading (${status.progress || 15}%). In the meantime, Fast Parser is active and commands will execute immediately.`,
          { engine: "deterministic" }
        );
      }
    } else {
      try {
        const answer = await smolLm2Engine.generate(cleanText, undefined, params.onToken);
        if (answer && answer.trim().length > 0) {
          return await createResponse(answer.trim(), { engine: "smollm2_wasm" });
        }
      } catch (err) {
        console.warn("[assistantEngine] SmolLM2 inference failed, falling back to fast parser:", err);
      }
    }
  }

  // STEP 4: Conversational Fast Parser
  const lower = cleanText.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))\b/i.test(lower)) {
    return await createResponse(
      "Hello! I am your Privatum Assistant. How can I assist you today? You can command me to prepare transfers, generate payment links, check address safety, or inspect spending guardrails."
    );
  }

  // Identity / Who are you
  if (/(who|what)\s+(are\s+you|is\s+this|assistant)/i.test(lower)) {
    return await createResponse(
      "I am the Privatum Assistant, an on-device transaction safety copilot for Robinhood Chain. I analyze recipient addresses against poisoning attacks, evaluate spending guardrails, and prepare transaction intents for your manual signature. I never hold private keys or broadcast transactions without your explicit approval."
    );
  }

  // Current Time / Date
  if (/\b(what('?s|\s+is)?\s+(the\s+)?(time|date|clock)|current\s+time)\b/i.test(lower)) {
    const now = new Date();
    return await createResponse(
      `The current local time is **${now.toLocaleTimeString()}** on **${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}** (UTC: ${now.toISOString().slice(11, 19)}).`
    );
  }

  // What is Privatum
  if (/what\s+is\s+privatum/i.test(lower)) {
    return await createResponse(
      "Privatum is an institutional-grade, non-custodial smart contract wallet on Robinhood Chain built with 2-of-2 MPC shard architecture. Your device holds Shard A, while the remote co-signer holds Shard B. It features stealth transfers, spending guardrails, and address poisoning protection."
    );
  }

  // Help / Commands
  if (/^(help|commands|what\s+can\s+you\s+do|features)/i.test(lower)) {
    return await createResponse(
      [
        "Here are common commands you can run:",
        "",
        "* **Transfers**: `Send 25 USDG to Alice` or `Send 0.1 ETH to 0x... with stealth`",
        "* **Payment Links**: `Create paylink for 50 USDG memo lunch`",
        "* **Emergency**: `Freeze wallet for 24 hours`",
        "* **Safety Check**: `Check address 0x... for poisoning`",
        "* **Limits**: `What are my spending limits?`",
        "* **Contacts**: `Show my contacts`",
        "",
        "You can also toggle **Enable AI** above for open-ended conversational reasoning.",
      ].join("\n")
    );
  }

  // Unparsed Fallback
  return await createResponse(
    [
      "I did not recognize a transaction command in your message.",
      "",
      "Try actions like:",
      "* `Send 10 USDG to Alice`",
      "* `Check address 0x...`",
      "* `What are my spending limits?`",
      "",
      "Or toggle **Enable AI** at the top of this drawer to ask open-ended questions.",
    ].join("\n")
  );
}
