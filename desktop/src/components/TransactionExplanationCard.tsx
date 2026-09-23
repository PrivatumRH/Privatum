import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import type { TransactionExplanation } from "../lib/transactionExplainer";

export function TransactionExplanationCard({ explanation }: { explanation: TransactionExplanation }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="pt-2.5 border-t border-white/10 space-y-2">
    <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full flex items-center justify-between text-xs text-left">
      <span className="flex items-center gap-1.5 text-slate-400"><FileSearch className="w-3.5 h-3.5 text-cyan-400" /><span className="font-medium">What will happen</span>{expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
      <span className="text-cyan-300 text-[11px]">Simulation Explainer</span>
    </button>
    {expanded && <div className="rounded-lg bg-black/50 border border-cyan-500/15 p-2.5 space-y-2 text-[11px]"><div><span className="text-slate-500">Operation: </span><span className="text-slate-200">{explanation.operation}</span></div><div><span className="text-slate-500">Path: </span><span className="text-slate-300">{explanation.executionPath}</span></div><div className="space-y-1">{explanation.movements.map((movement) => <div key={movement} className="flex gap-1.5 text-slate-300"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{movement}</div>)}{explanation.checks.map((check) => <div key={check} className="flex gap-1.5 text-slate-400"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />{check}</div>)}</div>{explanation.warning && <div className="flex gap-1.5 text-amber-300"><TriangleAlert className="w-3.5 h-3.5 shrink-0" />{explanation.warning}</div>}</div>}
  </div>;
}
