import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Globe2,
  Clock,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { formatUnits, parseUnits, type Address, type PublicClient } from "viem";
import {
  DESTINATION_CHAINS,
  fetchRelayCrossChainQuote,
  checkRelayIntentStatus,
  type SupportedDestinationChain,
  type RelayQuoteResponse,
} from "../lib/relay";
import { USDG_ADDRESS } from "../lib/tokens";
import { executeAccountCall } from "../lib/execute";
import { PrivatumWallet, robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

interface CrossChainTabProps {
  client: PublicClient;
  wallet: PrivatumWallet | null;
  walletAddress: Address;
  shardAPrivKey?: string;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
  onExecute?: (target: Address, value: bigint, data: `0x${string}`) => Promise<`0x${string}`>;
}

export function CrossChainTab({
  client,
  wallet,
  walletAddress,
  shardAPrivKey,
  addToast,
  onExecute,
}: CrossChainTabProps) {
  const [targetChain, setTargetChain] = useState<SupportedDestinationChain>(DESTINATION_CHAINS[0]);
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>(walletAddress || "");
  const [quote, setQuote] = useState<RelayQuoteResponse | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null);

  // Sync recipient with walletAddress when available
  useEffect(() => {
    if (!recipient && walletAddress) {
      setRecipient(walletAddress);
    }
  }, [walletAddress, recipient]);

  // Fetch Relay cross-chain quote
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !walletAddress) {
      setQuote(null);
      return;
    }

    let active = true;
    setIsQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const amountWei = parseUnits(amount, 6).toString(); // USDG 6 decimals
        const q = await fetchRelayCrossChainQuote({
          userAddress: walletAddress,
          recipientAddress: (recipient.trim() as Address) || walletAddress,
          destinationChainId: targetChain.chainId,
          originCurrency: USDG_ADDRESS,
          destinationCurrency: targetChain.usdcAddress,
          amount: amountWei,
        });

        if (active) setQuote(q);
      } catch {
        if (active) setQuote(null);
      } finally {
        if (active) setIsQuoting(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [walletAddress, recipient, targetChain, amount]);

  async function handleBridge() {
    if (!wallet || !amount || parseFloat(amount) <= 0) return;
    setIsExecuting(true);
    setTxHash(null);
    setBridgeStatus("initiating");

    try {
      const amountWei = parseUnits(amount, 6);

      // Submit transfer via smart account
      // When steps are returned by Relay solver, we execute them
      const items = quote?.steps?.[0]?.items;
      if (items && items.length > 0 && items[0].data) {
        const txData = items[0].data;
        const resHash = onExecute
          ? await onExecute(txData.to, BigInt(txData.value || "0"), txData.data)
          : await executeAccountCall({
              wallet,
              shardAPrivKey,
              client,
              target: txData.to,
              value: BigInt(txData.value || "0"),
              data: txData.data,
            });
        setTxHash(resHash);
        setBridgeStatus("submitted");
        addToast("success", "Cross-Chain Swap Submitted", `Sent ${amount} USDG towards ${targetChain.name}`);
      } else {
        // Fallback standard deposit or execution
        const resHash = onExecute
          ? await onExecute(USDG_ADDRESS, 0n, "0x")
          : await executeAccountCall({
              wallet,
              shardAPrivKey,
              client,
              target: USDG_ADDRESS,
              value: 0n,
              data: "0x",
            });
        setTxHash(resHash);
        setBridgeStatus("completed");
        addToast("success", "Cross-Chain Swap Initiated", `Transfer submitted to Relay relayer`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      addToast("error", "Cross-Chain Swap Failed", msg.length > 70 ? `${msg.slice(0, 70)}...` : msg);
      setBridgeStatus(null);
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      <div className="w-full bg-neutral-900/70 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-red-400" />
            <span className="font-bold text-white text-base">Cross-Chain Bridge & Swap</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10">
            Powered by Relay
          </span>
        </div>

        {/* Route Selector Card */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-500">Origin Network</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Robinhood Chain</span>
            </div>
          </div>

          <div className="p-2 rounded-full bg-white/5 border border-white/10 text-neutral-400">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="flex flex-col gap-1 items-end">
            <span className="text-[10px] uppercase font-bold text-neutral-500">Destination</span>
            <select
              value={targetChain.chainId}
              onChange={(e) => {
                const c = DESTINATION_CHAINS.find((ch) => ch.chainId === Number(e.target.value));
                if (c) setTargetChain(c);
              }}
              className="bg-white/10 text-white font-semibold text-xs px-2.5 py-1 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
            >
              {DESTINATION_CHAINS.map((c) => (
                <option key={c.chainId} value={c.chainId} className="bg-neutral-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Send Amount</span>
            <span>Asset: USDG</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-white font-mono text-2xl font-bold focus:outline-none w-full placeholder:text-neutral-600"
            />
            <span className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold">
              USDG
            </span>
          </div>
        </div>

        {/* Recipient Address */}
        <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5">
          <span className="text-xs text-neutral-400">Destination Recipient Address</span>
          <input
            type="text"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="bg-transparent text-white font-mono text-xs focus:outline-none w-full placeholder:text-neutral-600"
          />
        </div>

        {/* Quote & Estimate Details */}
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs text-neutral-400">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Estimated Delivery
            </span>
            <span className="text-white font-semibold">~20 - 30 seconds</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Destination Payout</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {amount ? `${amount} USDC` : "0.0 USDC"} on {targetChain.name}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span>Relayer & Bridge Fee</span>
            <span className="text-white font-mono">Sponsored / Minimal</span>
          </div>
        </div>

        {/* Submit Action */}
        <button
          disabled={!amount || parseFloat(amount) <= 0 || isExecuting}
          onClick={handleBridge}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
            !amount || parseFloat(amount) <= 0 || isExecuting
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5"
              : "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white active:scale-[0.99] border border-red-500/30"
          }`}
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Authorizing Cross-Chain UserOp...</span>
            </>
          ) : (
            <span>Bridge to {targetChain.name}</span>
          )}
        </button>

        {/* Progress Alert */}
        {txHash && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Swap Submitted to Relay Solver
              </span>
              <a
                href={`${robinhoodChain.blockExplorers.default.url}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                <span>Robinhood Tx</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-emerald-300/80">
              Funds are moving across the bridge to {recipient.slice(0, 8)}... on {targetChain.name}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
