import React from "react";
import { ArrowUpRight, Shield, ShieldAlert, Link2, Lock, Unlock, ArrowRight, X } from "lucide-react";
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

  return null;
};
