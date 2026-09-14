import React from "react";
import { ArrowRight, AlertTriangle, Zap, Coins, Fuel } from "lucide-react";
import { BalanceDiffResult } from "../lib/balanceDiff";

interface PreFlightBalanceDiffProps {
  diff: BalanceDiffResult;
}

export const PreFlightBalanceDiff: React.FC<PreFlightBalanceDiffProps> = ({ diff }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-3 select-none text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-white">Pre-Flight Balance Impact</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Est. Outlay: <strong className="text-white font-semibold">{diff.formattedTotalOutlayUsd}</strong>
        </span>
      </div>

      {/* Grid of Balances: Initial -> Change -> Projected */}
      <div className="space-y-2">
        {/* Primary Asset Row */}
        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
              {diff.asset} Balance
            </span>
            <div className="font-mono text-slate-300">{diff.formattedInitialAsset}</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-rose-400 font-medium">
              {diff.formattedSendAmount}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>

          <div className="text-right space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
              Projected
            </span>
            <div
              className={`font-mono font-semibold ${
                diff.hasInsufficientAsset ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {diff.formattedProjectedAsset}
            </div>
          </div>
        </div>

        {/* Native Gas Reserve Row (only show separate row if sending USDG; if sending ETH it's already the primary asset) */}
        {diff.asset === "USDG" && (
          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block flex items-center gap-1">
                <Fuel className="w-3 h-3 text-slate-400" />
                <span>ETH Gas Reserve</span>
              </span>
              <div className="font-mono text-slate-300">{diff.formattedInitialEth}</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {diff.isGasless ? (
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 font-sans">
                  <Zap className="w-3 h-3 fill-emerald-400/20" />
                  <span>Sponsored</span>
                </span>
              ) : (
                <span className="font-mono text-slate-400">{diff.formattedGasFeeEth}</span>
              )}
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </div>

            <div className="text-right space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Projected
              </span>
              <div
                className={`font-mono font-semibold ${
                  diff.hasInsufficientGas ? "text-rose-400" : "text-slate-200"
                }`}
              >
                {diff.formattedProjectedEth}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safeguard Alert Banners */}
      {diff.hasInsufficientAsset && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Insufficient {diff.asset} balance to complete this transfer.</span>
        </div>
      )}

      {diff.hasInsufficientGas && !diff.hasInsufficientAsset && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Insufficient ETH balance to cover the estimated network gas fee.</span>
        </div>
      )}

      {diff.isLowEthReserve && !diff.hasInsufficientGas && !diff.hasInsufficientAsset && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-300 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>Low gas reserve post-transfer: less than 0.001 ETH remaining for future transactions.</span>
        </div>
      )}
    </div>
  );
};
