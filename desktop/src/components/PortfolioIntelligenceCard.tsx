import React from "react";
import { Activity, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import type { PortfolioIntelligence } from "../lib/portfolioIntelligence";

export function PortfolioIntelligenceCard({ portfolio }: { portfolio: PortfolioIntelligence }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 shadow-xl">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#B91C3B]/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#f7a5ae]"><Sparkles className="h-3.5 w-3.5" /> AI portfolio intelligence</div>
          <h2 className="mt-1 text-lg font-semibold text-white">Your local posture snapshot</h2>
          <p className="mt-1 text-xs text-white/45">Derived from wallet balances and the local ledger. Nothing is uploaded.</p>
        </div>
        <div className="text-right"><div className="font-mono text-xl font-semibold text-white">${portfolio.totalUsd.toFixed(2)}</div><div className="text-[10px] text-white/40">tracked value</div></div>
      </div>
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        {portfolio.holdings.map((holding) => (
          <div key={holding.symbol} className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div className="flex items-center justify-between text-xs"><span className="font-semibold text-white">{holding.symbol}</span><span className="text-white/45">{holding.sharePercent.toFixed(1)}%</span></div>
            <div className="mt-1 text-[11px] text-white/45">{holding.label}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#B91C3B]" style={{ width: `${Math.min(100, holding.sharePercent)}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 space-y-2">
        {portfolio.insights.map((insight) => {
          const Icon = insight.kind === "warning" ? AlertTriangle : insight.kind === "positive" ? CheckCircle2 : Activity;
          const color = insight.kind === "warning" ? "text-amber-300" : insight.kind === "positive" ? "text-emerald-300" : "text-sky-300";
          return <div key={insight.title} className="flex items-start gap-2 text-xs"><Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} /><div><div className="font-medium text-white/90">{insight.title}</div><div className="text-white/45">{insight.detail}</div></div></div>;
        })}
      </div>
    </section>
  );
}
