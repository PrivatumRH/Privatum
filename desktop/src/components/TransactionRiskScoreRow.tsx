import React, { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import type { TransactionRiskAssessment } from "../lib/riskScore";

interface TransactionRiskScoreRowProps {
  assessment: TransactionRiskAssessment;
}

export const TransactionRiskScoreRow: React.FC<TransactionRiskScoreRowProps> = ({ assessment }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pt-2.5 border-t border-white/10 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between text-xs hover:opacity-90 transition group select-none text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-slate-200">
          {assessment.level === "high" ? (
            <ShieldAlert className="w-3.5 h-3.5 text-[#f64943] shrink-0" />
          ) : assessment.level === "medium" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">Risk Score</span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1.5 font-medium">
          <span
            className="text-xs"
            style={{ color: assessment.color }}
          >
            {assessment.label}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">({assessment.score}/100)</span>
        </div>
      </button>

      {expanded && (
        <div className="rounded-lg bg-black/50 border border-white/5 p-2.5 space-y-2 text-[11px]">
          <div className="text-slate-400 text-[10px] leading-relaxed pb-1.5 border-b border-white/5">
            {assessment.summary}
          </div>

          <div className="space-y-1.5">
            {assessment.factors.map((factor) => (
              <div key={factor.id} className="flex items-start justify-between gap-3">
                <span className="text-slate-400 shrink-0">{factor.name}:</span>
                <span
                  className={`text-right text-[10px] leading-snug ${
                    factor.status === "fail"
                      ? "text-[#f64943] font-medium"
                      : factor.status === "warn"
                      ? "text-amber-400 font-medium"
                      : "text-emerald-400"
                  }`}
                >
                  {factor.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
