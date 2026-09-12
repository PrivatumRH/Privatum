import { useState } from "react";
import { X, Shield, AlertTriangle, RotateCcw } from "lucide-react";
import {
  type SpendingGuardrailConfig,
  saveGuardrailConfig,
  clearSpendingHistory,
} from "../lib/spendGuardrails";

interface GuardrailSettingsModalProps {
  walletAddress: string;
  config: SpendingGuardrailConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: SpendingGuardrailConfig) => void;
  onHistoryReset: () => void;
}

const PRESET_DAILY_LIMITS = [100, 250, 500, 1000, 2500];

export function GuardrailSettingsModal({
  walletAddress,
  config,
  isOpen,
  onClose,
  onSave,
  onHistoryReset,
}: GuardrailSettingsModalProps) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [dailyLimit, setDailyLimit] = useState(config.dailyLimitUsd.toString());
  const [singleTxLimit, setSingleTxLimit] = useState(config.singleTxLimitUsd.toString());
  const [strictMode, setStrictMode] = useState(config.strictMode);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const dailyNum = Math.max(1, parseFloat(dailyLimit) || 500);
    const singleNum = Math.max(0, parseFloat(singleTxLimit) || 0);

    const updated: SpendingGuardrailConfig = {
      enabled,
      dailyLimitUsd: dailyNum,
      singleTxLimitUsd: singleNum,
      strictMode,
    };

    saveGuardrailConfig(walletAddress, updated);
    onSave(updated);
    onClose();
  };

  const handleResetHistory = () => {
    clearSpendingHistory(walletAddress);
    onHistoryReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0e1015] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 text-white select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Spending Guardrails</h3>
              <p className="text-xs text-slate-400">In-app financial limits and transfer protection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div>
              <div className="text-sm font-medium">Enable Guardrails</div>
              <div className="text-xs text-slate-400">Monitor and enforce limits on outgoing transfers</div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                enabled ? "bg-white" : "bg-white/15"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                  enabled ? "translate-x-6 bg-[#0e1015]" : "translate-x-1 bg-white"
                }`}
              />
            </button>
          </div>

          {/* Daily Limit */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">
              Daily Limit (USD equivalent)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="any"
                min="1"
                disabled={!enabled}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="500"
                className="w-full pl-8 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-white/30 disabled:opacity-40"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
              {PRESET_DAILY_LIMITS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setDailyLimit(preset.toString())}
                  className={`px-2 py-0.5 text-xs rounded-md border transition ${
                    dailyLimit === preset.toString()
                      ? "bg-white/15 text-white border-white/25"
                      : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.08]"
                  } disabled:opacity-40`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Single Transaction Cap */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">
              Single Transfer Cap (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="any"
                min="0"
                disabled={!enabled}
                value={singleTxLimit}
                onChange={(e) => setSingleTxLimit(e.target.value)}
                placeholder="250"
                className="w-full pl-8 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-white/30 disabled:opacity-40"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Flags any single transaction exceeding this amount. Set to 0 to disable.
            </p>
          </div>

          {/* Strict Mode Toggle */}
          <div className="flex items-start justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] gap-3">
            <div>
              <div className="text-sm font-medium">Strict Hard Block</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {strictMode
                  ? "Transfers exceeding limits cannot be signed until the 24h window clears."
                  : "Requires explicit acknowledgment and confirmation to override limits."}
              </div>
            </div>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => setStrictMode(!strictMode)}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-40 ${
                strictMode ? "bg-white" : "bg-white/15"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full transition-transform absolute top-1 ${
                  strictMode ? "translate-x-6 bg-[#0e1015]" : "translate-x-1 bg-white"
                }`}
              />
            </button>
          </div>

          {/* Reset 24h History */}
          <div className="pt-1">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset 24h spending accumulator</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-rose-300 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Reset spending history?</span>
                </div>
                <p className="text-rose-200/80">
                  This will zero out your accumulated 24h spend records for this wallet.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResetHistory}
                    className="px-3 py-1 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1 bg-white/10 text-slate-300 rounded-lg hover:bg-white/15 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium bg-white text-black rounded-xl hover:bg-slate-200 transition shadow-sm cursor-pointer"
            >
              Save Guardrails
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
