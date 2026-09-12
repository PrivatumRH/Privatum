import { useState } from "react";
import { Shield, SlidersHorizontal, AlertCircle } from "lucide-react";
import {
  type SpendingGuardrailConfig,
  type SpendingRecord,
  get24hSpendTotal,
} from "../lib/spendGuardrails";
import { GuardrailSettingsModal } from "./GuardrailSettingsModal";

interface GuardrailCardProps {
  walletAddress: string;
  config: SpendingGuardrailConfig;
  history: SpendingRecord[];
  onConfigChange: (newConfig: SpendingGuardrailConfig) => void;
  onHistoryReset: () => void;
}

export function GuardrailCard({
  walletAddress,
  config,
  history,
  onConfigChange,
  onHistoryReset,
}: GuardrailCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const spentToday = get24hSpendTotal(history);
  const dailyLimit = config.dailyLimitUsd;
  const percentUsed = dailyLimit > 0 ? Math.min(100, Math.round((spentToday / dailyLimit) * 100)) : 0;
  const remaining = Math.max(0, Math.round((dailyLimit - spentToday) * 100) / 100);
  const isNearLimit = percentUsed >= 75 && percentUsed < 100;
  const isExceeded = spentToday > dailyLimit;

  return (
    <>
      <div className="rounded-2xl bg-[#0e1015] border border-white/[0.08] p-5 space-y-4 select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Spending Guardrails</span>
                {!config.enabled && (
                  <span className="text-[11px] font-mono text-slate-500">(Disabled)</span>
                )}
                {config.strictMode && config.enabled && (
                  <span className="text-[11px] font-mono text-slate-400">(Strict Lock)</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {config.enabled
                  ? `24-hour limit: $${dailyLimit.toFixed(2)} USD`
                  : "Protection disabled in settings"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Configure</span>
          </button>
        </div>

        {/* Meter & Figures */}
        {config.enabled ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-baseline justify-between text-xs">
              <div className="text-slate-400">
                Spent in 24h:{" "}
                <span className="font-mono font-medium text-white">
                  ${spentToday.toFixed(2)}
                </span>
              </div>
              <div className="text-slate-400">
                Remaining:{" "}
                <span
                  className={`font-mono font-medium ${
                    isExceeded
                      ? "text-rose-400"
                      : isNearLimit
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  ${remaining.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/[0.04]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isExceeded
                    ? "bg-rose-500"
                    : isNearLimit
                    ? "bg-amber-400"
                    : "bg-white"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>{percentUsed}% of daily allowance</span>
              {config.singleTxLimitUsd > 0 && (
                <span>Single-tx cap: ${config.singleTxLimitUsd.toFixed(2)}</span>
              )}
            </div>

            {isExceeded && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Daily cap reached. Further transfers will trigger a guardrail alert.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-400 flex items-center justify-between">
            <span>Guardrails are paused. Transactions will not be evaluated against limits.</span>
            <button
              onClick={() => setModalOpen(true)}
              className="text-white hover:underline text-xs font-medium cursor-pointer ml-2 shrink-0"
            >
              Turn On
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <GuardrailSettingsModal
          walletAddress={walletAddress}
          config={config}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={onConfigChange}
          onHistoryReset={onHistoryReset}
        />
      )}
    </>
  );
}
