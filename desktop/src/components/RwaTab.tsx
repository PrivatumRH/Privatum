import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { formatUnits, type Address, type PublicClient } from "viem";
import { TOKENS, type TokenInfo } from "../lib/tokens";

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
            Real-world assets deployed natively on Robinhood Chain
          </p>
        </div>
      </div>

      {/* Equities List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {equities.map((eq) => {
          const bal = balances[eq.symbol] || "0.00";
          return (
            <div
              key={eq.symbol}
              onClick={() => onTradeToken(eq.symbol)}
              className="p-4 rounded-2xl bg-[#181a22] border border-white/[0.08] hover:border-white/20 hover:bg-[#181a22]/90 transition-all cursor-pointer flex items-center justify-between group shadow-lg active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                {eq.icon ? (
                  <img
                    src={eq.icon}
                    alt={eq.symbol}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 bg-neutral-900 border border-white/10"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md"
                    style={{ backgroundColor: eq.color || "#3b82f6" }}
                  >
                    {eq.symbol.slice(0, 2)}
                  </div>
                )}

                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">
                    {eq.name}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">{eq.symbol}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-neutral-500">Balance</span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {parseFloat(bal).toFixed(2)}
                  </span>
                </div>

                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-white/20 group-hover:bg-white/10 transition">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
