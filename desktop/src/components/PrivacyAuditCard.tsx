import React, { useState } from "react";
import { ChevronDown, ChevronRight, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PrivacyAudit } from "../lib/privacyAuditor";

export function PrivacyAuditCard({ audit }: { audit: PrivacyAudit }) {
  const [expanded, setExpanded] = useState(false);
  const tone = audit.score >= 80 ? "text-emerald-400" : audit.score >= 55 ? "text-amber-400" : "text-rose-400";
  return <div className="pt-2.5 border-t border-white/10 space-y-2">
    <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full flex items-center justify-between text-xs text-left">
      <span className="flex items-center gap-1.5 text-slate-400"><EyeOff className={`w-3.5 h-3.5 ${tone}`} /><span className="font-medium">Privacy Scanner</span>{expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
      <span className={`font-medium ${tone}`}>{audit.label} <span className="font-mono text-[10px] text-slate-500">({audit.score}/100)</span></span>
    </button>
    {expanded && <div className="rounded-lg bg-black/50 border border-white/5 p-2.5 space-y-2 text-[11px]"><p className="text-slate-400 text-[10px] pb-1.5 border-b border-white/5">{audit.summary}</p>{audit.findings.map((finding) => <div key={finding.id} className="flex gap-2"><span>{finding.severity === "pass" ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldAlert className={`w-3.5 h-3.5 ${finding.severity === "fail" ? "text-rose-400" : "text-amber-400"}`} />}</span><span><b className="text-slate-300">{finding.title}.</b> <span className="text-slate-400">{finding.detail}</span></span></div>)}</div>}
  </div>;
}
