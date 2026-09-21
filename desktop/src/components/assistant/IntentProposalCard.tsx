import React from "react";
import { ArrowUpRight, Shield, ShieldAlert, ShieldCheck, Ban, Link2, Lock, Unlock, ArrowRight, X, Layers, Download, Radio, Inbox, Trash2, Activity, HeartPulse, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ParsedIntent } from "../../lib/assistant/types";
import type { InferenceReceipt } from "../../lib/assistant/inferenceReceipt";
import { evaluateTransactionRisk } from "../../lib/riskScore";

interface IntentProposalCardProps {
  intent: ParsedIntent;
  receipt?: InferenceReceipt;
  safetyEvidence?: {
    poisonVerdict?: "safe" | "warning" | "danger";
    poisonMessage?: string;
    guardrailVerdict?: "allowed" | "blocked" | "warning";
    guardrailMessage?: string;
    contactMatch?: string;
    intentSummary?: string;
  };
  onApplyIntent: (intent: ParsedIntent) => void;
  onDismiss?: () => void;
}

export const IntentProposalCard: React.FC<IntentProposalCardProps> = ({
  intent,
  receipt,
  safetyEvidence,
  onApplyIntent,
  onDismiss,
}) => {
  if (intent.type === "send_transfer") {
    const isDanger = safetyEvidence?.poisonVerdict === "danger" || safetyEvidence?.guardrailVerdict === "blocked";
    const risk = evaluateTransactionRisk({
      recipient: intent.recipient,
      addressVerdict: safetyEvidence?.poisonVerdict ? {
        level: safetyEvidence.poisonVerdict === "danger" ? "danger" : safetyEvidence.poisonVerdict === "warning" ? "warning" : "ok",
        title: "Address Screening",
        detail: safetyEvidence.poisonMessage || "",
      } : null,
      guardrailVerdict: safetyEvidence?.guardrailVerdict ? {
        allowed: safetyEvidence.guardrailVerdict === "allowed",
        warning: safetyEvidence.guardrailVerdict === "warning",
        message: safetyEvidence.guardrailMessage || "",
      } : null,
      contacts: safetyEvidence?.contactMatch ? [{ address: intent.recipient }] : [],
      isStealth: intent.isStealth,
    });

    return (
      <div className={`mt-3 rounded-xl border p-3.5 text-xs transition-colors ${
        isDanger ? "border-[#f54842]/40 bg-[#f54842]/10" : "border-white/10 bg-white/[0.04]"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <ArrowUpRight className="h-3.5 w-3.5 text-[#f54842]" />
            <span>Proposed Transfer</span>
          </div>
          <div className="flex items-center gap-1.5">
            {intent.isStealth && (
              <span className="text-[10px] text-white/50 border border-white/10 px-1.5 py-0.5 rounded">
                Stealth Mode
              </span>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
                title="Dismiss proposal"
                aria-label="Dismiss proposal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Amount:</span>
            <span className="font-semibold text-white">{intent.amount} {intent.asset}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Recipient:</span>
            <span className="font-mono text-white">
              {intent.recipientName ? `${intent.recipientName} (${intent.recipient.slice(0, 6)}...${intent.recipient.slice(-4)})` : `${intent.recipient.slice(0, 8)}...${intent.recipient.slice(-6)}`}
            </span>
          </div>

          {safetyEvidence?.poisonVerdict && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-white/40">Address Guard:</span>
              <span className={`flex items-center gap-1 font-medium ${
                safetyEvidence.poisonVerdict === "danger"
                  ? "text-[#f54842]"
                  : safetyEvidence.poisonVerdict === "warning"
                  ? "text-yellow-400"
                  : "text-emerald-400"
              }`}>
                {safetyEvidence.poisonVerdict === "danger" ? (
                  <ShieldAlert className="h-3 w-3" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {safetyEvidence.poisonVerdict === "danger" ? "Look-Alike Risk" : safetyEvidence.poisonVerdict === "warning" ? "Notice" : "Clean"}
              </span>
            </div>
          )}

          {safetyEvidence?.guardrailVerdict && (
            <div className="flex items-center justify-between">
              <span className="text-white/40">Spending Limit:</span>
              <span className={safetyEvidence.guardrailVerdict === "blocked" ? "text-[#f54842] font-semibold" : "text-white/70"}>
                {safetyEvidence.guardrailVerdict === "blocked" ? "Limit Breached" : "Within Cap"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-white/40">Risk Score:</span>
            <span className="font-semibold text-[11px]" style={{ color: risk.color }}>
              {risk.label}
            </span>
          </div>

          {receipt && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-white/40">Inference Proof:</span>
              <span className="font-mono text-[10px] text-white/50">{receipt.shortRef}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#f54842] hover:bg-[#e03e38] transition-colors"
          >
            <span>Review in Send Form</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "create_paylink") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Link2 className="h-3.5 w-3.5 text-[#f54842]" />
            <span>Proposed Payment Link</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Expected Amount:</span>
            <span className="font-semibold text-white">{intent.amount} {intent.asset}</span>
          </div>
          {intent.memo && (
            <div className="flex justify-between">
              <span className="text-white/40">Memo:</span>
              <span className="text-white">{intent.memo}</span>
            </div>
          )}
          {receipt && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-white/40">Inference Proof:</span>
              <span className="font-mono text-[10px] text-white/50">{receipt.shortRef}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#f54842] hover:bg-[#e03e38] transition-colors"
          >
            <span>Open Pay Links Tab</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "panic_freeze") {
    return (
      <div className="mt-3 rounded-xl border border-[#f54842]/40 bg-[#f54842]/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#f54842]/20">
          <div className="flex items-center gap-1.5 font-medium text-[#f54842]">
            <Lock className="h-3.5 w-3.5" />
            <span>Emergency Panic Freeze</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Duration: {intent.hours ? `${intent.hours} hours` : "Until manual unlock"}. Co-Signer Shard B will be locked against outgoing transfers.
        </p>
        {receipt && (
          <div className="flex items-center justify-between mb-3 text-[10px] pt-1 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#f54842] hover:bg-[#e03e38] transition-colors"
          >
            <span>Open Freeze Modal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "unfreeze_wallet") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Unlock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Unfreeze Wallet</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          {intent.code ? `Ready to submit authenticator code ${intent.code}.` : "Requires 6-digit authenticator code from recovery device."}
        </p>
        {receipt && (
          <div className="flex items-center justify-between mb-3 text-[10px] pt-1 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-black bg-white hover:bg-white/90 transition-colors"
          >
            <span>Open Unfreeze Flow</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "export_ledger") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Download className="h-3.5 w-3.5 text-[#f54842]" />
            <span>Export Transaction History</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Download your local ledger as RFC-4180 CSV or structured audit JSON for tax accounting and self-custody records.
        </p>
        <button
          type="button"
          onClick={() => onApplyIntent(intent)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#f54842] hover:bg-[#e03e38] transition-colors"
        >
          <span>Open Export Dialog</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (intent.type === "multi_intent_plan") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            <span>Multi-Step Execution Plan ({intent.steps.length} actions)</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-2 mb-3">
          {intent.steps.map((step) => (
            <div
              key={step.stepIndex}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/30 border border-white/5"
            >
              <div className="min-w-0">
                <div className="font-medium text-white truncate text-[11px]">{step.label}</div>
                <div className="text-[10px] text-white/60 truncate">{step.summary}</div>
              </div>
              <button
                type="button"
                onClick={() => onApplyIntent(step.intent)}
                className="shrink-0 py-1 px-2.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium text-[10px] transition-colors cursor-pointer"
              >
                Execute
              </button>
            </div>
          ))}
        </div>
        {receipt && (
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
      </div>
    );
  }

  if (intent.type === "broadcast_outbox") {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-amber-400">
            <Radio className="h-3.5 w-3.5" />
            <span>Queued Outbox Broadcast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-300 font-medium border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">
              {intent.queuedCount} {intent.queuedCount === 1 ? "transfer" : "transfers"} ready
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
                title="Dismiss proposal"
                aria-label="Dismiss proposal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-white/80 mb-3 leading-relaxed">
          Broadcasting will sequentially submit your signed offline transactions to Robinhood Chain in strict nonce order.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-black bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <span>Broadcast Queued Transfers ({intent.queuedCount})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
        {receipt && (
          <div className="flex items-center justify-between text-[10px] pt-2 mt-2 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
      </div>
    );
  }

  if (intent.type === "view_outbox") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Inbox className="h-3.5 w-3.5 text-[#f54842]" />
            <span>Offline Transaction Outbox</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Open your Offline Outbox modal to inspect signed payloads, verify sequential nonces, and manage broadcasts.
        </p>
        <button
          type="button"
          onClick={() => onApplyIntent(intent)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#f54842] hover:bg-[#e03e38] transition-colors cursor-pointer"
        >
          <span>Open Offline Outbox</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (intent.type === "clear_outbox_history") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Trash2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>Clear Completed Outbox History</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Purge completed and failed transaction records from local storage. Active queued transfers awaiting broadcast are preserved.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <span>Clear Outbox History</span>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "add_whitelist") {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Approve Whitelist Counterparty</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1.5 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Address:</span>
            <span className="font-mono text-white text-[11px]">{intent.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Label:</span>
            <span className="font-medium text-white">{intent.label}</span>
          </div>
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Adding this address to your approved whitelist permits direct transfers even when Strict Treasury Mode is enforced.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-black bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            <span>Add to Approved Whitelist</span>
            <ShieldCheck className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
        {receipt && (
          <div className="flex items-center justify-between text-[10px] pt-2 mt-2 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
      </div>
    );
  }

  if (intent.type === "remove_whitelist") {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Revoke Whitelist Approval</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1.5 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Address:</span>
            <span className="font-mono text-white text-[11px]">{intent.address}</span>
          </div>
          {intent.label && (
            <div className="flex justify-between">
              <span className="text-white/40">Label:</span>
              <span className="font-medium text-white">{intent.label}</span>
            </div>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Revoking approval will remove this address from your trusted list. If Strict Treasury Mode is active, future transfers to it will be blocked.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer"
          >
            <span>Revoke Whitelist Approval</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "add_blacklist") {
    return (
      <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-rose-400">
            <Ban className="h-3.5 w-3.5" />
            <span>Block Threat Counterparty</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1.5 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Address:</span>
            <span className="font-mono text-white text-[11px]">{intent.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Category:</span>
            <span className="font-semibold text-rose-300">{intent.category}</span>
          </div>
          {intent.reason && (
            <div className="flex justify-between">
              <span className="text-white/40">Reason:</span>
              <span className="text-white/80">{intent.reason}</span>
            </div>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Adding this address to your threat blacklist will strictly block any outgoing transfers to it during pre-flight checks.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer"
          >
            <span>Block Address & Enforce Blacklist</span>
            <Ban className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
        {receipt && (
          <div className="flex items-center justify-between text-[10px] pt-2 mt-2 border-t border-white/5">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}
      </div>
    );
  }

  if (intent.type === "remove_blacklist") {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Unlock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Unblock Blacklisted Address</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
              title="Dismiss proposal"
              aria-label="Dismiss proposal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-1.5 mb-3 text-white/80">
          <div className="flex justify-between">
            <span className="text-white/40">Address:</span>
            <span className="font-mono text-white text-[11px]">{intent.address}</span>
          </div>
          {intent.name && (
            <div className="flex justify-between">
              <span className="text-white/40">Label:</span>
              <span className="font-medium text-white">{intent.name}</span>
            </div>
          )}
        </div>
        <p className="text-white/70 mb-3 leading-relaxed">
          Unblocking will restore standard transaction routing for this address in the Send flow.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-black bg-white hover:bg-white/90 transition-colors cursor-pointer"
          >
            <span>Unblock Address</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "wallet_health_report") {
    const isGood = intent.grade === "A+" || intent.grade === "A";
    const isFair = intent.grade === "B";
    const isWarn = intent.grade === "C" || intent.grade === "Warning";

    const badgeColor = isGood
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : isFair
      ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
      : "border-rose-500/30 bg-rose-500/10 text-rose-400";

    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
            <span>Wallet Health & Security Audit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeColor}`}>
              Score: {intent.score}/100 [Grade {intent.grade}]
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
                title="Dismiss report"
                aria-label="Dismiss report"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Pillar 1: Guardrails */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Guardrails</span>
              <span className={`text-[10px] font-medium ${
                intent.pillars.guardrails.status === "healthy" ? "text-emerald-400" : "text-amber-400"
              }`}>
                {intent.pillars.guardrails.status.toUpperCase()}
              </span>
            </div>
            <div className="text-white/80 text-[11px] font-medium">
              {intent.pillars.guardrails.usagePercent}% Used
            </div>
            <p className="text-[10px] text-white/50 truncate" title={intent.pillars.guardrails.detail}>
              {intent.pillars.guardrails.detail}
            </p>
          </div>

          {/* Pillar 2: Security & Whitelist */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Defense</span>
              <span className={`text-[10px] font-medium ${
                intent.pillars.security.status === "healthy" ? "text-emerald-400" : "text-rose-400"
              }`}>
                {intent.pillars.security.status.toUpperCase()}
              </span>
            </div>
            <div className="text-white/80 text-[11px] font-medium">
              {intent.pillars.security.whitelistCount} Whitelisted
            </div>
            <p className="text-[10px] text-white/50 truncate" title={intent.pillars.security.detail}>
              {intent.pillars.security.detail}
            </p>
          </div>

          {/* Pillar 3: 7-Day Velocity */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Velocity (7d)</span>
              <span className={`text-[10px] font-medium ${
                intent.pillars.velocity.status === "healthy" ? "text-emerald-400" : "text-amber-400"
              }`}>
                {intent.pillars.velocity.status.toUpperCase()}
              </span>
            </div>
            <div className="text-white/80 text-[11px] font-medium">
              ${intent.pillars.velocity.sevenDayTotalUsd.toFixed(2)} USD
            </div>
            <p className="text-[10px] text-white/50 truncate" title={intent.pillars.velocity.detail}>
              ${intent.pillars.velocity.dailyAverageUsd.toFixed(2)}/day
            </p>
          </div>

          {/* Pillar 4: Hygiene & Outbox */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-[10px] uppercase tracking-wider">Hygiene</span>
              <span className={`text-[10px] font-medium ${
                intent.pillars.hygiene.status === "healthy" ? "text-emerald-400" : "text-amber-400"
              }`}>
                {intent.pillars.hygiene.status === "healthy" ? "HEALTHY" : "ATTN"}
              </span>
            </div>
            <div className="text-white/80 text-[11px] font-medium">
              {intent.pillars.hygiene.untaggedCount} Untagged
            </div>
            <p className="text-[10px] text-white/50 truncate" title={intent.pillars.hygiene.detail}>
              {intent.pillars.hygiene.outboxPending} outbox pending
            </p>
          </div>
        </div>

        {/* Actionable Recommendations */}
        {intent.recommendations && intent.recommendations.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
            <div className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">Recommendations</div>
            <ul className="space-y-1 text-white/70 text-[11px]">
              {intent.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-white/30 shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Action Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent({ type: "view_guardrails" })}
            className="flex-1 py-1.5 px-2.5 rounded-lg font-medium text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer text-center"
          >
            Inspect Guardrails
          </button>
          <button
            type="button"
            onClick={() => onApplyIntent({ type: "export_ledger" })}
            className="flex-1 py-1.5 px-2.5 rounded-lg font-medium text-[11px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer text-center"
          >
            Export Audit
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-1.5 px-2.5 rounded-lg font-medium text-[11px] text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};
