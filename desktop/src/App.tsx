import React, { useState } from "react";
import { Shield, KeyRound, Server, Fingerprint, Send, Download, RefreshCw } from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<"assets" | "shards">("assets");

  return (
    <div className="min-h-screen bg-[#080d14] text-slate-100 font-sans p-6">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-[#38B6FF]/40 flex items-center justify-center text-[#38B6FF]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wider text-base">PRIVATUM DESKTOP</h1>
            <span className="text-[11px] font-mono text-[#38B6FF]">Robinhood Chain · Chain ID 4663</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("assets")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "assets"
                ? "bg-[#38B6FF] text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab("shards")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "shards"
                ? "bg-[#38B6FF] text-slate-950 font-semibold"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Shard Health
          </button>
        </div>
      </header>

      {/* Content */}
      {activeTab === "assets" ? (
        <div className="space-y-6">
          {/* Total Value */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-mono text-slate-400">Total Portfolio Value</span>
            <div className="text-3xl font-bold text-white mt-1">$12,450.00</div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 py-2.5 rounded-xl bg-[#38B6FF] text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[#38B6FF]/90 transition">
                <Send className="w-3.5 h-3.5" />
                <span>Send (Private)</span>
              </button>
              <button className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-700 transition">
                <Download className="w-3.5 h-3.5" />
                <span>Stealth Receive</span>
              </button>
            </div>
          </div>

          {/* Frontier Assets List */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">Frontier Assets</h2>

            {/* USDG */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                  $
                </div>
                <div>
                  <div className="text-sm font-medium text-white">USDG</div>
                  <div className="text-[11px] text-slate-500">Robinhood Stablecoin</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">10,000.00 USDG</div>
                <div className="text-[11px] text-slate-500">$10,000.00</div>
              </div>
            </div>

            {/* ETH */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#38B6FF]/10 text-[#38B6FF] border border-[#38B6FF]/20 flex items-center justify-center font-bold text-xs">
                  Ξ
                </div>
                <div>
                  <div className="text-sm font-medium text-white">ETH</div>
                  <div className="text-[11px] text-slate-500">Robinhood Chain Native Gas</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">0.98 ETH</div>
                <div className="text-[11px] text-slate-500">$2,450.00</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">2-of-3 Quorum Status</h2>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-white">Shard A · Local Keyring</div>
                <div className="text-[11px] text-slate-500">OS Keystore encrypted at rest</div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-white">Shard B · Co-Signer</div>
                <div className="text-[11px] text-slate-500">Connected to api.privatumrh.com</div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Online
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-5 h-5 text-[#38B6FF]" />
              <div>
                <div className="text-sm font-medium text-white">Shard C · Passkey Recovery</div>
                <div className="text-[11px] text-slate-500">Hardware Touch ID / Passkey enrolled</div>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#38B6FF]/10 text-[#38B6FF] border border-[#38B6FF]/20">
              Configured
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
