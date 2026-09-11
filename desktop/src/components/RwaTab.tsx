import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import { formatUnits, type Address, type PublicClient } from "viem";
import { TOKENS, type TokenInfo } from "../lib/tokens";
import { robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

interface RwaTabProps {
  client: PublicClient;
  walletAddress: Address;
  onTradeToken: (symbol: string) => void;
  onCopyAddress: (address: string) => void;
}

export function RwaTab({
  client,
  walletAddress,
  onTradeToken,
  onCopyAddress,
}: RwaTabProps) {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const equities = TOKENS.filter((t) => t.isRwa);

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;

    async function loadBalances() {
      const results: Record<string, string> = {};
      await Promise.all(
        equities.map(async (token) => {
          try {
            const bal = await client.readContract({
              address: token.address,
              abi: [
                {
                  name: "balanceOf",
                  type: "function",
                  inputs: [{ name: "account", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }],
                  stateMutability: "view",
                },
              ],
              functionName: "balanceOf",
              args: [walletAddress],
            });
            results[token.symbol] = formatUnits(bal, token.decimals);
          } catch {
            results[token.symbol] = "0.00";
          }
        })
      );
      if (active) setBalances(results);
    }

    loadBalances();
    return () => {
      active = false;
    };
  }, [client, walletAddress, equities]);

  function shorten(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>Robinhood Tokenized Equities & RWA</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Institutional real-world assets deployed natively on Robinhood Chain
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Verified On-Chain
        </span>
      </div>

      {/* Equities List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {equities.map((eq) => {
          const bal = balances[eq.symbol] || "0.00";
          return (
            <div
              key={eq.symbol}
              onClick={() => onTradeToken(eq.symbol)}
              className="p-4 rounded-2xl bg-neutral-900/70 border border-white/10 hover:border-white/20 hover:bg-neutral-900/90 transition-all cursor-pointer backdrop-blur-xl flex items-center justify-between group shadow-lg active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                  style={{ backgroundColor: eq.color || "#3b82f6" }}
                >
                  {eq.symbol.slice(0, 2)}
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">
                      {eq.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono">
                      RWA
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">{eq.name}</span>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono mt-0.5">
                    <span>{shorten(eq.address)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyAddress(eq.address);
                      }}
                      className="p-0.5 hover:text-white"
                      title="Copy Token Contract"
                    >
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                    <a
                      href={`${robinhoodChain.blockExplorers.default.url}/token/${eq.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-0.5 hover:text-white"
                      title="Explorer"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-neutral-500">Balance</span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {parseFloat(bal).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-400 group-hover:text-red-400 transition-colors">
                  <span>Trade</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
