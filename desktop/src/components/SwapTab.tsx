import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowDownUp,
  RotateCw,
  Fuel,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ChevronDown,
  Layers,
} from "lucide-react";
import { formatUnits, parseUnits, type Address, type Hex, type PublicClient } from "viem";
import { TOKENS, type TokenInfo, findToken } from "../lib/tokens";
import { getBestSwapQuote, buildSwapBatchCalls, type SwapQuoteResult } from "../lib/swap";
import { executeAccountBatch } from "../lib/execute";
import { PrivatumWallet, robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

interface SwapTabProps {
  client: PublicClient;
  wallet: PrivatumWallet | null;
  walletAddress: Address;
  shardAPrivKey?: string;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
  preselectedTokenIn?: string;
  preselectedTokenOut?: string;
  onExecuteBatch?: (targets: Address[], values: bigint[], datas: Hex[]) => Promise<Hex>;
}

export function SwapTab({
  client,
  wallet,
  walletAddress,
  shardAPrivKey,
  addToast,
  preselectedTokenIn = "USDG",
  preselectedTokenOut = "AAPL",
  onExecuteBatch,
}: SwapTabProps) {
  const [tokenIn, setTokenIn] = useState<TokenInfo>(() => findToken(preselectedTokenIn) || TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(() => findToken(preselectedTokenOut) || TOKENS[2]);
  const [amountIn, setAmountIn] = useState<string>("");
  const [quote, setQuote] = useState<SwapQuoteResult | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [slippageBps, setSlippageBps] = useState<number>(50); // 0.5% default

  const [balanceIn, setBalanceIn] = useState<string>("0.00");
  const [balanceOut, setBalanceOut] = useState<string>("0.00");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Fetch token balances
  const refreshBalances = useCallback(async () => {
    if (!walletAddress) return;
    try {
      if (tokenIn.native) {
        const bal = await client.getBalance({ address: walletAddress });
        setBalanceIn(formatUnits(bal, 18));
      } else {
        const bal = await client.readContract({
          address: tokenIn.address,
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
        setBalanceIn(formatUnits(bal, tokenIn.decimals));
      }

      if (tokenOut.native) {
        const bal = await client.getBalance({ address: walletAddress });
        setBalanceOut(formatUnits(bal, 18));
      } else {
        const bal = await client.readContract({
          address: tokenOut.address,
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
        setBalanceOut(formatUnits(bal, tokenOut.decimals));
      }
    } catch {
      // Fallback
    }
  }, [client, walletAddress, tokenIn, tokenOut]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Debounced quote fetch
  useEffect(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setQuote(null);
      return;
    }

    let active = true;
    setIsQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const q = await getBestSwapQuote(client, tokenIn, tokenOut, amountIn);
        if (active) {
          setQuote(q);
        }
      } catch (err) {
        if (active) setQuote(null);
      } finally {
        if (active) setIsQuoting(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, tokenIn, tokenOut, amountIn]);

  function flipTokens() {
    const prevIn = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(prevIn);
    setAmountIn("");
    setQuote(null);
  }

  async function handleSwap() {
    if (!wallet || !quote || !amountIn) return;
    setIsSwapping(true);
    setLastTxHash(null);

    try {
      const amountInRaw = parseUnits(amountIn, tokenIn.decimals);
      const minAmountOutRaw = (quote.amountOutRaw * BigInt(10000 - slippageBps)) / 10000n;

      const { targets, values, datas } = buildSwapBatchCalls({
        accountAddress: walletAddress,
        tokenIn,
        tokenOut,
        amountIn: amountInRaw,
        minAmountOut: minAmountOutRaw,
        feeTier: quote.feeTier,
      });

      // Submit atomic executeBatch transaction via 2-of-3 threshold smart account
      const txHash = onExecuteBatch
        ? await onExecuteBatch(targets, values, datas)
        : await executeAccountBatch({
            wallet,
            shardAPrivKey,
            client,
            targets,
            values,
            datas,
          });
      setLastTxHash(txHash);
      addToast("success", "Swap Executed", `Swapped ${amountIn} ${tokenIn.symbol} for ${quote.amountOut} ${tokenOut.symbol}`);
      setAmountIn("");
      setQuote(null);
      refreshBalances();
    } catch (err: any) {
      const msg = err?.message || String(err);
      addToast("error", "Swap Failed", msg.length > 70 ? `${msg.slice(0, 70)}...` : msg);
    } finally {
      setIsSwapping(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      <div className="w-full bg-neutral-900/70 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">Robinhood DEX Swap</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" /> v4 / v3 Pools
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-xs text-neutral-400">
            {[20, 50, 100].map((b) => (
              <button
                key={b}
                onClick={() => setSlippageBps(b)}
                className={`px-2 py-0.5 rounded-lg transition-all ${
                  slippageBps === b ? "bg-white/15 text-white font-semibold" : "hover:text-neutral-200"
                }`}
              >
                {b / 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Token In Box */}
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>You Pay</span>
            <div className="flex items-center gap-1">
              <span>Bal: {parseFloat(balanceIn).toFixed(4)}</span>
              <button
                onClick={() => setAmountIn(balanceIn)}
                className="text-red-400 hover:text-red-300 font-semibold ml-1"
              >
                MAX
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="bg-transparent text-white font-mono text-2xl font-bold focus:outline-none w-full placeholder:text-neutral-600"
            />

            <select
              value={tokenIn.symbol}
              onChange={(e) => {
                const sel = findToken(e.target.value);
                if (sel) setTokenIn(sel);
              }}
              className="bg-white/10 text-white font-semibold text-sm px-3 py-2 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
            >
              {TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-neutral-900 text-white">
                  {t.symbol} {t.isRwa ? "(RWA)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flip Button */}
        <div className="flex justify-center -my-2 z-10">
          <button
            onClick={flipTokens}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-white/15 text-neutral-300 hover:text-white transition-all shadow-md active:scale-95"
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </div>

        {/* Token Out Box */}
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>You Receive</span>
            <span>Bal: {parseFloat(balanceOut).toFixed(4)}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-2xl font-bold text-white min-h-[32px] flex items-center">
              {isQuoting ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              ) : quote ? (
                parseFloat(quote.amountOut).toFixed(4)
              ) : (
                <span className="text-neutral-600">0.0</span>
              )}
            </div>

            <select
              value={tokenOut.symbol}
              onChange={(e) => {
                const sel = findToken(e.target.value);
                if (sel) setTokenOut(sel);
              }}
              className="bg-white/10 text-white font-semibold text-sm px-3 py-2 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
            >
              {TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-neutral-900 text-white">
                  {t.symbol} {t.isRwa ? "(RWA)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quote Details */}
        {quote && (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-400">
            <div className="flex justify-between items-center">
              <span>Execution Rate</span>
              <span className="text-white font-mono">
                1 {tokenIn.symbol} ≈ {quote.rate.toFixed(4)} {tokenOut.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Route & Venue</span>
              <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">
                Uniswap {quote.protocol.toUpperCase()} ({quote.feeTier / 10000}%)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Slippage Protection</span>
              <span className="text-white font-mono">{slippageBps / 100}%</span>
            </div>
          </div>
        )}

        {/* Swap Action Button */}
        <button
          disabled={!quote || isSwapping || isQuoting || !amountIn || parseFloat(amountIn) <= 0}
          onClick={handleSwap}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
            !quote || isSwapping || isQuoting || !amountIn || parseFloat(amountIn) <= 0
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5"
              : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white active:scale-[0.99] border border-red-500/30"
          }`}
        >
          {isSwapping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authorizing 2-of-3 Threshold Batch...</span>
            </>
          ) : isQuoting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching Best Pool Rate...</span>
            </>
          ) : !amountIn || parseFloat(amountIn) <= 0 ? (
            <span>Enter an Amount</span>
          ) : !quote ? (
            <span>Insufficient Liquidity</span>
          ) : (
            <span>Swap Tokens Atomically</span>
          )}
        </button>

        {/* Success Link */}
        {lastTxHash && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Swap confirmed on Robinhood Chain</span>
            </div>
            <a
              href={`${robinhoodChain.blockExplorers.default.url}/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <span>Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
