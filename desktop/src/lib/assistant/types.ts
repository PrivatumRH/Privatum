export type AssistantIntentType =
  | "send_transfer"
  | "create_paylink"
  | "panic_freeze"
  | "unfreeze_wallet"
  | "check_address"
  | "view_guardrails"
  | "view_contacts"
  | "export_ledger"
  | "explain_tx"
  | "broadcast_outbox"
  | "view_outbox"
  | "clear_outbox_history"
  | "outbox_query"
  | "add_whitelist"
  | "remove_whitelist"
  | "add_blacklist"
  | "remove_blacklist"
  | "security_query"
  | "spending_analytics"
  | "wallet_health_report"
  | "ledger_search"
  | "batch_payment"
  | "shard_health"
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

export interface ParsedMultiIntent {
  type: "multi_intent_plan";
  steps: {
    intent: ParsedIntent;
    stepIndex: number;
    label: string;
    summary: string;
  }[];
}

export interface ParsedLedgerQueryIntent {
  type: "ledger_query";
  queryType?: string;
  summary: string;
  details?: string[];
}

export interface ParsedBroadcastOutboxIntent {
  type: "broadcast_outbox";
  queuedCount: number;
}

export interface ParsedViewOutboxIntent {
  type: "view_outbox";
}

export interface ParsedClearOutboxHistoryIntent {
  type: "clear_outbox_history";
}

export interface ParsedOutboxQueryIntent {
  type: "outbox_query";
  queryType?:
    | "outbox_summary"
    | "next_nonce"
    | "failure_diagnostic"
    | "airgap_status";
  summary: string;
  details?: string[];
}

export interface ParsedAddWhitelistIntent {
  type: "add_whitelist";
  address: string;
  label: string;
}

export interface ParsedRemoveWhitelistIntent {
  type: "remove_whitelist";
  address: string;
  label?: string;
}

export interface ParsedAddBlacklistIntent {
  type: "add_blacklist";
  address: string;
  name?: string;
  reason?: string;
  category: "Phishing" | "Malicious" | "Sanctioned" | "Compromised" | "Custom";
}

export interface ParsedRemoveBlacklistIntent {
  type: "remove_blacklist";
  address: string;
  name?: string;
}

export interface ParsedSecurityQueryIntent {
  type: "security_query";
  queryType?:
    | "whitelist_status"
    | "blacklist_status"
    | "threat_diagnostic"
    | "poisoning_diagnostic"
    | "policy_overview";
  summary: string;
  details?: string[];
  address?: string;
}

export interface ParsedSpendingAnalyticsIntent {
  type: "spending_analytics";
  subtype:
    | "top_counterparties"
    | "tag_breakdown"
    | "velocity"
    | "counterparty_detail";
  timeframe?: "week" | "month";
  tag?: string;
  counterparty?: string;
  summary: string;
  details?: string[];
  chartData?: { label: string; value: number; color?: string }[];
}

export interface ParsedWalletHealthReportIntent {
  type: "wallet_health_report";
  summary: string;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "Warning";
  pillars: {
    guardrails: {
      status: "healthy" | "warning" | "disabled";
      usagePercent: number;
      detail: string;
    };
    security: {
      status: "healthy" | "warning" | "danger";
      whitelistCount: number;
      blacklistCount: number;
      detail: string;
    };
    velocity: {
      status: "healthy" | "elevated" | "low";
      sevenDayTotalUsd: number;
      dailyAverageUsd: number;
      detail: string;
    };
    hygiene: {
      status: "healthy" | "needs_attention";
      untaggedCount: number;
      outboxPending: number;
      detail: string;
    };
  };
  recommendations: string[];
}

export interface ParsedLedgerSearchIntent {
  type: "ledger_search";
  summary: string;
  filters: {
    tag?: string;
    counterparty?: string;
    counterpartyName?: string;
    direction?: "send" | "receive" | "all";
    minAmount?: number;
    maxAmount?: number;
    asset?: string;
    timeframe?: string;
  };
  matchCount: number;
  totalVolumeByAsset: Record<string, number>;
  matches: {
    type: "send" | "receive";
    counterparty: string;
    counterpartyName?: string;
    amount: string;
    asset: string;
    timestamp?: number;
    tag?: string;
    hash?: string;
  }[];
}

export interface ParsedBatchPaymentIntent {
  type: "batch_payment";
  items: {
    recipient: string;
    recipientName?: string;
    amount: string;
    asset: "ETH" | "USDG";
    tag?: string;
    isStealth?: boolean;
  }[];
  totalAmounts: Record<string, number>;
  itemCount: number;
  scheduledDelay?: string;
  isScheduled: boolean;
  estimatedGasSavingsPercent: number;
  checks: {
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    message: string;
  }[];
  allChecksPassed: boolean;
}

export interface ParsedShardHealthIntent {
  type: "shard_health";
  report: import("../shardHealth").ShardHealthReport;
}

export type ParsedIntent =
  | ParsedTransferIntent
  | ParsedPaylinkIntent
  | ParsedFreezeIntent
  | ParsedUnfreezeIntent
  | ParsedCheckAddressIntent
  | ParsedMultiIntent
  | ParsedLedgerQueryIntent
  | ParsedBroadcastOutboxIntent
  | ParsedViewOutboxIntent
  | ParsedClearOutboxHistoryIntent
  | ParsedOutboxQueryIntent
  | ParsedAddWhitelistIntent
  | ParsedRemoveWhitelistIntent
  | ParsedAddBlacklistIntent
  | ParsedRemoveBlacklistIntent
  | ParsedSecurityQueryIntent
  | ParsedSpendingAnalyticsIntent
  | ParsedWalletHealthReportIntent
  | ParsedLedgerSearchIntent
  | ParsedBatchPaymentIntent
  | ParsedShardHealthIntent
  | { type: "view_guardrails" }
  | { type: "view_contacts" }
  | { type: "export_ledger" }
  | { type: "explain_tx"; txHash: string }
  | { type: "general_query"; query: string };

export type EngineMode = "deterministic" | "smollm2_wasm" | "ollama";

export interface ModelLoadingProgress {
  status: "idle" | "downloading" | "loading" | "ready" | "error";
  progress?: number;
  text?: string;
}

import type { InferenceReceipt } from "./inferenceReceipt";
import type { ReceiptTranscript } from "./receiptExport";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  intent?: ParsedIntent;
  inferenceReceipt?: InferenceReceipt;
  /**
   * Plaintext the receipt's hashes commit to, retained so the receipt can be
   * exported and re-verified offline. Always the POST-redaction prompt -
   * raw input is never stored here.
   */
  transcript?: ReceiptTranscript;
  safetyEvidence?: {
    poisonVerdict?: "safe" | "warning" | "danger";
    poisonMessage?: string;
    guardrailVerdict?: "allowed" | "blocked" | "warning";
    guardrailMessage?: string;
    contactMatch?: string;
    intentSummary?: string;
  };
}
