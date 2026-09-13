import React, { useMemo } from "react";
import { Clock, ShieldCheck, TrendingUp } from "lucide-react";
import type { SpendingGuardrailConfig, SpendingRecord } from "../lib/spendGuardrails";
import {
  budgetTone,
  computeUsage,
  formatCountdown,
  nextCapacityRelease,
  projectedRemainingAt,
  type BudgetTone,
} from "../lib/guardrailForecast";

interface GuardrailBudgetBarProps {
  config: SpendingGuardrailConfig;
  history: SpendingRecord[];
  /** USD value of the transfer being composed, to preview its effect. */
  pendingUsd?: number;
  /** Injected in tests; defaults to the real clock. */
  now?: number;
}

const TONE: Record<BudgetTone, { bar: string; text: string; label: string }> = {
  clear: { bar: "bg-emerald-400", text: "text-emerald-300", label: "Within limits" },
  moderate: { bar: "bg-sky-400", text: "text-sky-300", label: "Half used" },
  high: { bar: "bg-amber-400", text: "text-amber-300", label: "Nearly spent" },
  exhausted: { bar: "bg-red-400", text: "text-red-300", label: "Limit reached" },
};

export const GuardrailBudgetBar: React.FC<GuardrailBudgetBarProps> = ({
  config,
  history,
  pendingUsd = 0,
  now = Date.now(),
}) => {
  const usage = useMemo(() => computeUsage(config, history, now), [config, history, now]);
  const release = useMemo(() => nextCapacityRelease(history, now), [history, now]);

  if (!usage.enabled) return null;

  const tone = TONE[budgetTone(usage)];

  // The pending transfer is drawn as a separate segment so a user can see what
  // this send costs them, distinct from what they have already spent.
  const pendingFraction =
    usage.limitUsd > 0 ? Math.min(1 - usage.fraction, pendingUsd / usage.limitUsd) : 0;
  const wouldExceed = pendingUsd > 0 && usage.usedUsd + pendingUsd > usage.limitUsd;

  // Only worth telling someone to wait if waiting would actually help.
  const releaseHelps =
    wouldExceed &&
    release !== null &&
    projectedRemainingAt(config, history, release.at) >= pendingUsd;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-white/40" />
          <span className="text-[10px] font-semibold text-white/60">24h Spending Budget</span>
        </div>
        <span className={`text-[10px] font-mono font-semibold ${tone.text}`}>{tone.label}</span>
      </div>

      {/* Used, then the pending transfer, against the cap */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden flex">
        <div
          className={`h-full ${tone.bar} transition-all duration-500`}
          style={{ width: `${usage.fraction * 100}%` }}
        />
        {pendingFraction > 0 && (
          <div
            className="h-full bg-white/35 transition-all duration-500"
            style={{ width: `${pendingFraction * 100}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-white/45">
          ${usage.usedUsd.toFixed(2)}
          <span className="text-white/20"> / </span>
          <span className="text-white/35">${usage.limitUsd.toFixed(2)}</span>
        </span>
        <span className="text-white/35">${usage.remainingUsd.toFixed(2)} left</span>
      </div>

      {pendingUsd > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] pt-1.5 border-t border-white/[0.07]">
          <TrendingUp className="w-2.5 h-2.5 text-white/30 shrink-0" />
          <span className="text-white/40">This transfer</span>
          <span className="font-mono text-white/60">${pendingUsd.toFixed(2)}</span>
          {wouldExceed && <span className="text-red-300 font-medium">exceeds your cap</span>}
        </div>
      )}

      {/* The rolling window is the whole point: headroom returns gradually, not
          at midnight, so say exactly when and how much. */}
      {release !== null && (
        <div className="flex items-start gap-1.5 text-[10px] pt-1.5 border-t border-white/[0.07]">
          <Clock className="w-2.5 h-2.5 text-white/30 shrink-0 mt-[3px]" />
          <span className="text-white/40 leading-relaxed">
            <span className="font-mono text-white/60">${release.amountUsd.toFixed(2)}</span> of
            headroom returns in{" "}
            <span className="font-mono text-white/60">{formatCountdown(release.inMs)}</span>
            {releaseHelps && (
              <span className="text-emerald-300"> — enough for this transfer</span>
            )}
          </span>
        </div>
      )}

      {release === null && usage.usedUsd === 0 && (
        <p className="text-[10px] text-white/25 pt-1.5 border-t border-white/[0.07]">
          No spending in the last 24 hours. Full budget available.
        </p>
      )}
    </div>
  );
};
