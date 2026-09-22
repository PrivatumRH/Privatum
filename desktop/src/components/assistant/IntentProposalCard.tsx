import React from "react";
import { ArrowUpRight, Shield, ShieldAlert, ShieldCheck, Ban, Link2, Lock, Unlock, ArrowRight, X, Layers, Download, Radio, Inbox, Trash2, Activity, HeartPulse, CheckCircle2, AlertTriangle, Search, Users, Zap, Clock, Cpu, Server } from "lucide-react";
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
        isDanger ? "border-[#B91C3B]/40 bg-[#B91C3B]/10" : "border-white/10 bg-white/[0.04]"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <ArrowUpRight className="h-3.5 w-3.5 text-[#B91C3B]" />
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
                  ? "text-[#B91C3B]"
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
              <span className={safetyEvidence.guardrailVerdict === "blocked" ? "text-[#B91C3B] font-semibold" : "text-white/70"}>
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#B91C3B] hover:bg-[#9D1632] transition-colors"
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
            <Link2 className="h-3.5 w-3.5 text-[#B91C3B]" />
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#B91C3B] hover:bg-[#9D1632] transition-colors"
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
      <div className="mt-3 rounded-xl border border-[#B91C3B]/40 bg-[#B91C3B]/10 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#B91C3B]/20">
          <div className="flex items-center gap-1.5 font-medium text-[#B91C3B]">
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#B91C3B] hover:bg-[#9D1632] transition-colors"
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
            <Download className="h-3.5 w-3.5 text-[#B91C3B]" />
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
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#B91C3B] hover:bg-[#9D1632] transition-colors"
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
            <Inbox className="h-3.5 w-3.5 text-[#B91C3B]" />
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
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-white bg-[#B91C3B] hover:bg-[#9D1632] transition-colors cursor-pointer"
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

  if (intent.type === "ledger_search") {
    const filterTags: string[] = [];
    if (intent.filters.tag) filterTags.push(`Tag: ${intent.filters.tag}`);
    if (intent.filters.counterpartyName) {
      filterTags.push(`Counterparty: ${intent.filters.counterpartyName}`);
    } else if (intent.filters.counterparty) {
      filterTags.push(`Counterparty: ${intent.filters.counterparty.slice(0, 6)}...${intent.filters.counterparty.slice(-4)}`);
    }
    if (intent.filters.direction && intent.filters.direction !== "all") {
      filterTags.push(`Type: ${intent.filters.direction.toUpperCase()}`);
    }
    if (intent.filters.asset) filterTags.push(`Asset: ${intent.filters.asset}`);
    if (intent.filters.minAmount !== undefined && intent.filters.maxAmount !== undefined) {
      filterTags.push(`Amount: ${intent.filters.minAmount}-${intent.filters.maxAmount}`);
    } else if (intent.filters.minAmount !== undefined) {
      filterTags.push(`Amount: >${intent.filters.minAmount}`);
    } else if (intent.filters.maxAmount !== undefined) {
      filterTags.push(`Amount: <${intent.filters.maxAmount}`);
    }
    if (intent.filters.timeframe) filterTags.push(`Time: ${intent.filters.timeframe}`);

    const volumeParts = Object.entries(intent.totalVolumeByAsset).map(
      ([asset, sum]) => `${sum.toFixed(2)} ${asset}`
    );

    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Search className="h-3.5 w-3.5 text-sky-400" />
            <span>Ledger Search & Recall</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-400">
              {intent.matchCount} matched
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-white/40 hover:text-white rounded hover:bg-white/5 transition-colors"
                title="Dismiss search results"
                aria-label="Dismiss search results"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Badges */}
        {filterTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2.5">
            {filterTags.map((f, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.04] border border-white/10 text-white/70"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Results Slice */}
        {intent.matches.length === 0 ? (
          <p className="text-white/50 text-[11px] py-2">
            No transactions matched the specified criteria in local storage.
          </p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {intent.matches.slice(0, 5).map((tx, idx) => {
              const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "";
              const cpStr = tx.counterpartyName || `${tx.counterparty.slice(0, 6)}...${tx.counterparty.slice(-4)}`;
              const isSend = tx.type === "send";

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase ${
                        isSend ? "bg-[#B91C3B]/10 text-[#B91C3B]" : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {tx.type}
                    </span>
                    <span className="text-white/80 font-medium truncate" title={tx.counterparty}>
                      {cpStr}
                    </span>
                    {tx.tag && (
                      <span className="text-[10px] text-white/40 border border-white/10 px-1 py-0.2 rounded shrink-0">
                        {tx.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-semibold text-white">
                      {isSend ? "-" : "+"}{tx.amount} {tx.asset}
                    </span>
                    {dateStr && <div className="text-[9px] text-white/40">{dateStr}</div>}
                  </div>
                </div>
              );
            })}

            {intent.matches.length > 5 && (
              <div className="text-center text-[10px] text-white/40 pt-1">
                +{intent.matches.length - 5} more matching record(s)
              </div>
            )}
          </div>
        )}

        {/* Volume Summary */}
        {volumeParts.length > 0 && (
          <div className="flex items-center justify-between text-[11px] mb-3 pt-2 border-t border-white/5 text-white/70">
            <span className="text-white/40">Total Matched Volume:</span>
            <span className="font-semibold text-white">{volumeParts.join(" + ")}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent({ type: "export_ledger" })}
            className="flex-1 py-1.5 px-2.5 rounded-lg font-medium text-[11px] text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-colors cursor-pointer text-center"
          >
            Export Filtered Ledger
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

  if (intent.type === "batch_payment") {
    const totalVolumeParts = Object.entries(intent.totalAmounts).map(
      ([asset, total]) => `${total.toFixed(2)} ${asset}`
    );

    return (
      <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] p-3.5 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-indigo-500/20">
          <div className="flex items-center gap-1.5 font-medium text-indigo-400">
            <Users className="h-3.5 w-3.5" />
            <span>Pre-Flight Batch Payment Proposal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-indigo-300 font-medium border border-indigo-400/30 bg-indigo-400/10 px-1.5 py-0.5 rounded">
              {intent.itemCount} Transfers
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

        {/* Schedule delay banner if present */}
        {intent.isScheduled && intent.scheduledDelay && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] mb-2.5">
            <Clock className="h-3 w-3 shrink-0" />
            <span>Scheduled Release: {intent.scheduledDelay}</span>
          </div>
        )}

        {/* Total Outflow & Gas Savings Banner */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 mb-3">
          <div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Total Aggregated Outflow</div>
            <div className="text-sm font-semibold text-white mt-0.5">
              {totalVolumeParts.join(" + ")}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end text-[10px] text-emerald-400 font-medium">
              <Zap className="h-3 w-3" />
              <span>~{intent.estimatedGasSavingsPercent}% Gas Saved</span>
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Atomic Batch UserOp
            </div>
          </div>
        </div>

        {/* Itemized Recipients */}
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium px-0.5">
            Recipients ({intent.items.length})
          </div>
          {intent.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/30 border border-white/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-white truncate text-[11px]">
                    {item.recipientName || `${item.recipient.slice(0, 6)}...${item.recipient.slice(-4)}`}
                  </span>
                  {item.tag && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-white/70 font-mono">
                      {item.tag}
                    </span>
                  )}
                  {item.isStealth && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                      Stealth
                    </span>
                  )}
                </div>
                {item.recipientName && (
                  <div className="text-[9px] font-mono text-white/40 truncate">
                    {item.recipient.slice(0, 8)}...{item.recipient.slice(-6)}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="font-semibold text-white text-[11px]">
                  {item.amount} {item.asset}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Preflight Checks List */}
        <div className="space-y-1 mb-3 pt-2 border-t border-white/5">
          {intent.checks.map((chk) => (
            <div key={chk.id} className="flex items-start gap-1.5 text-[10px]">
              {chk.status === "pass" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              ) : chk.status === "warn" ? (
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-3 w-3 text-[#B91C3B] shrink-0 mt-0.5" />
              )}
              <span className={chk.status === "pass" ? "text-white/70" : chk.status === "warn" ? "text-amber-300" : "text-[#B91C3B]"}>
                {chk.message}
              </span>
            </div>
          ))}
        </div>

        {/* Inference Proof */}
        {receipt && (
          <div className="flex items-center justify-between text-[10px] pb-3 border-b border-white/5 mb-3">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApplyIntent(intent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <span>Stage Batch into Outbox ({intent.itemCount})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 px-3 rounded-lg font-medium text-xs text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }

  if (intent.type === "shard_health") {
    const report = intent.report;
    const scoreColor = report.score >= 90 ? "text-emerald-400" : report.score >= 60 ? "text-amber-400" : "text-[#B91C3B]";
    const badgeBorder = report.score >= 90 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : report.score >= 60 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-[#B91C3B]/30 bg-[#B91C3B]/10 text-[#B91C3B]";

    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <Cpu className="h-3.5 w-3.5 text-[#B91C3B]" />
            <span>Threshold MPC &amp; Shard Diagnostics</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeBorder}`}>
              {report.overallStatus.toUpperCase()}
            </span>
            <span className={`text-[11px] font-bold font-mono ${scoreColor}`}>
              {report.score}/100
            </span>
          </div>
        </div>

        {/* Shards Status Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Shard A */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-white">
                <Lock className="w-3 h-3 text-[#B91C3B]" />
                <span>Shard A (Device)</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                report.shardA.status === "healthy" ? "bg-emerald-500/20 text-emerald-300" :
                report.shardA.status === "degraded" ? "bg-amber-500/20 text-amber-300" : "bg-[#B91C3B]/20 text-[#B91C3B]"
              }`}>
                {report.shardA.status}
              </span>
            </div>
            <p className="text-[10px] text-white/60 leading-tight">
              {report.shardA.detail}
            </p>
          </div>

          {/* Shard B */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-white">
                <Server className="w-3 h-3 text-cyan-400" />
                <span>Shard B (Cosigner)</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                report.shardB.status === "healthy" ? "bg-emerald-500/20 text-emerald-300" :
                report.shardB.status === "degraded" ? "bg-amber-500/20 text-amber-300" :
                report.shardB.status === "offline" ? "bg-[#B91C3B]/20 text-[#B91C3B]" : "bg-white/10 text-white/50"
              }`}>
                {report.shardB.status}
              </span>
            </div>
            <p className="text-[10px] text-white/60 leading-tight">
              {report.shardB.detail}
            </p>
          </div>
        </div>

        {/* Ceremony Performance Breakdown */}
        {report.ceremony && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 mb-3">
            <div className="flex items-center justify-between text-[11px] text-white/80 mb-1.5">
              <span className="font-medium text-white flex items-center gap-1">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span>Last Signing Ceremony</span>
              </span>
              <span className="font-mono text-[10px] text-white/50">
                {report.ceremony.totalElapsedMs}ms total ({report.ceremony.overallGrade})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-white/[0.02] rounded p-1">
                <div className="text-[9px] text-white/40">Shard A Signing</div>
                <div className="text-[10px] font-mono text-white/80">
                  {report.ceremony.shardALatencyMs !== undefined ? `${report.ceremony.shardALatencyMs}ms` : "N/A"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded p-1">
                <div className="text-[9px] text-white/40">Shard B Round-Trip</div>
                <div className="text-[10px] font-mono text-cyan-300">
                  {report.ceremony.coSignerLatencyMs !== null ? `${report.ceremony.coSignerLatencyMs}ms` : "N/A"}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded p-1">
                <div className="text-[9px] text-white/40">Stages Status</div>
                <div className="text-[10px] font-mono text-white/80">
                  {report.ceremony.stagesCompleted} done{report.ceremony.stagesFailed > 0 ? `, ${report.ceremony.stagesFailed} failed` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations && report.recommendations.length > 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 mb-3">
            <div className="text-[10px] font-medium text-white/60 mb-1">Diagnostics Notes:</div>
            <ul className="space-y-1">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="text-[10px] text-white/70 flex items-start gap-1">
                  <span className="text-[#B91C3B] select-none">*</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {receipt && (
          <div className="flex items-center justify-between text-[10px] pb-3 border-b border-white/5 mb-3">
            <span className="text-white/40">Inference Proof:</span>
            <span className="font-mono text-white/50">{receipt.shortRef}</span>
          </div>
        )}

        {/* Dismiss Button */}
        <div className="flex items-center justify-end gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="py-1.5 px-3 rounded-lg font-medium text-xs text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
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
