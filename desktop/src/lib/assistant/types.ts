export type AssistantIntentType =
  | "send_transfer"
  | "create_paylink"
  | "panic_freeze"
  | "unfreeze_wallet"
  | "check_address"
  | "view_guardrails"
  | "view_contacts"
  | "explain_tx"
  | "general_query";

export interface ParsedTransferIntent {
  type: "send_transfer";
  recipient: string;
  recipientName?: string;
  amount: string;
  asset: "ETH" | "USDG";
  isStealth: boolean;
  confidence: number;
}

export interface ParsedPaylinkIntent {
  type: "create_paylink";
  amount: string;
  asset: "ETH" | "USDG";
  memo?: string;
}

export interface ParsedFreezeIntent {
  type: "panic_freeze";
  hours: number | null;
}

export interface ParsedUnfreezeIntent {
  type: "unfreeze_wallet";
  code?: string;
}

export interface ParsedCheckAddressIntent {
  type: "check_address";
  address: string;
}

export type ParsedIntent =
  | ParsedTransferIntent
  | ParsedPaylinkIntent
  | ParsedFreezeIntent
  | ParsedUnfreezeIntent
  | ParsedCheckAddressIntent
  | { type: "view_guardrails" }
  | { type: "view_contacts" }
  | { type: "explain_tx"; txHash: string }
  | { type: "general_query"; query: string };

export type EngineMode = "deterministic" | "smollm2_wasm" | "ollama";

export interface ModelLoadingProgress {
  status: "idle" | "downloading" | "loading" | "ready" | "error";
  progress?: number;
  text?: string;
}

import type { InferenceReceipt } from "./inferenceReceipt";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  intent?: ParsedIntent;
  inferenceReceipt?: InferenceReceipt;
  safetyEvidence?: {
    poisonVerdict?: "safe" | "warning" | "danger";
    poisonMessage?: string;
    guardrailVerdict?: "allowed" | "blocked" | "warning";
    guardrailMessage?: string;
    contactMatch?: string;
    intentSummary?: string;
  };
}
