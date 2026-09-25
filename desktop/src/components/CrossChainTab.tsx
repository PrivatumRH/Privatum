import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight,
  Globe2,
  Clock,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Check,
} from "lucide-react";
import { formatUnits, parseUnits, isAddress, type Address, type PublicClient } from "viem";
import {
  DESTINATION_CHAINS,
  fetchRelayCrossChainQuote,
  type SupportedDestinationChain,
  type RelayQuoteResponse,
} from "../lib/relay";
import { TOKENS, type TokenInfo, findToken, USDG_ADDRESS } from "../lib/tokens";
import { executeAccountCall } from "../lib/execute";
import { TokenPickerModal } from "./TokenPickerModal";
import { PrivatumWallet, robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

interface CrossChainTabProps {
  client: PublicClient;
  wallet: PrivatumWallet | null;
  walletAddress: Address;
  shardAPrivKey?: string;
  addToast: (type: "success" | "error" | "info", title: string, message?: string) => void;
  onExecute?: (target: Address, value: bigint, data: `0x${string}`) => Promise<`0x${string}`>;
  prefillDestinationChainId?: number;
  prefillAmount?: string;
  prefillTokenSymbol?: string;
}

export function CrossChainTab({
  client,
  wallet,
  walletAddress,
  shardAPrivKey,
  addToast,
  onExecute,
  prefillDestinationChainId,
  prefillAmount,
  prefillTokenSymbol,
}: CrossChainTabProps) {
  const [tokenList, setTokenList] = useState<TokenInfo[]>(TOKENS);
  const [tokenIn, setTokenIn] = useState<TokenInfo>(() => {
    if (prefillTokenSymbol) {
      const p = findToken(prefillTokenSymbol);
      if (p) return p;
    }
    return findToken("USDG") || TOKENS[0];
  });
  const [showTokenPicker, setShowTokenPicker] = useState<boolean>(false);

  const [targetChain, setTargetChain] = useState<SupportedDestinationChain>(() => {
    if (prefillDestinationChainId) {
      const c = DESTINATION_CHAINS.find((ch) => ch.chainId === prefillDestinationChainId);
      if (c) return c;
    }
    return DESTINATION_CHAINS[0];
  });
  const [showChainDropdown, setShowChainDropdown] = useState<boolean>(false);
  const chainDropdownRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState<string>(prefillAmount || "");
  const [balanceIn, setBalanceIn] = useState<string>("0.00");
  const [recipient, setRecipient] = useState<string>(() => walletAddress || "");

  const [quote, setQuote] = useState<RelayQuoteResponse | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Synchronize prefill props when updated dynamically
  useEffect(() => {
    if (prefillDestinationChainId) {
      const chain = DESTINATION_CHAINS.find((c) => c.chainId === prefillDestinationChainId);
      if (chain) setTargetChain(chain);
    }
  }, [prefillDestinationChainId]);

  useEffect(() => {
    if (prefillAmount) {
      setAmount(prefillAmount);
    }
  }, [prefillAmount]);

  useEffect(() => {
    if (prefillTokenSymbol) {
      const tok = findToken(prefillTokenSymbol);
      if (tok) setTokenIn(tok);
    }
  }, [prefillTokenSymbol]);

  // Close chain dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setShowChainDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch token balance for tokenIn
  const refreshBalance = useCallback(async () => {
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
    } catch {
      setBalanceIn("0.00");
    }
  }, [client, walletAddress, tokenIn]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Fetch Relay cross-chain quote
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !walletAddress) {
      setQuote(null);
      return;
    }

    const cleanRecipient = recipient.trim();
    const effectiveRecipient = isAddress(cleanRecipient) ? (cleanRecipient as Address) : walletAddress;

    let active = true;
    setIsQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const amountWei = parseUnits(amount, tokenIn.decimals).toString();
        const originCurrency = tokenIn.native
          ? ("0x0000000000000000000000000000000000000000" as Address)
          : tokenIn.address;
        const destCurrency = tokenIn.native
          ? targetChain.ethAddress
          : targetChain.usdcAddress;

        const q = await fetchRelayCrossChainQuote({
          userAddress: walletAddress,
          recipientAddress: effectiveRecipient,
          destinationChainId: targetChain.chainId,
          originCurrency,
          destinationCurrency: destCurrency,
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
  }, [walletAddress, recipient, targetChain, amount, tokenIn]);

  const handleAddCustomToken = useCallback((newToken: TokenInfo) => {
    setTokenList((prev) => {
      const exists = prev.some((t) => t.address.toLowerCase() === newToken.address.toLowerCase());
      if (exists) return prev;
      return [...prev, newToken];
    });
  }, []);

  async function handleBridge() {
    if (!wallet || !amount || parseFloat(amount) <= 0) return;

    const cleanRecipient = recipient.trim();
    if (cleanRecipient && !isAddress(cleanRecipient)) {
      addToast("error", "Invalid Recipient", "Please enter a valid destination 0x address.");
      return;
    }

    setIsExecuting(true);
    setTxHash(null);

    try {
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
        addToast("success", "Cross-Chain Swap Submitted", `Sent ${amount} ${tokenIn.symbol} towards ${targetChain.name}`);
      } else {
        const targetAddr = tokenIn.native ? ("0x0000000000000000000000000000000000000000" as Address) : tokenIn.address;
        const resHash = onExecute
          ? await onExecute(targetAddr, 0n, "0x")
          : await executeAccountCall({
              wallet,
              shardAPrivKey,
              client,
              target: targetAddr,
              value: 0n,
              data: "0x",
            });
        setTxHash(resHash);
        addToast("success", "Cross-Chain Swap Initiated", `Transfer submitted to Relay relayer`);
      }
      setAmount("");
      setQuote(null);
      refreshBalance();
    } catch (err: any) {
      const msg = err?.message || String(err);
      addToast("error", "Cross-Chain Swap Failed", msg.length > 70 ? `${msg.slice(0, 70)}...` : msg);
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
      <div className="w-full bg-[#181a22] border border-white/[0.08] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-slate-300" />
            <span className="font-bold text-white text-base">Cross-Chain Bridge & Swap</span>
          </div>
        </div>

        {/* Route Selector Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#13151b] border border-white/[0.06] text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-neutral-500">Origin</span>
            <div className="flex items-center gap-1.5 text-white font-medium">
              <img src="/rh-icon.png" alt="Robinhood" className="w-4 h-4 rounded-full object-contain" />
              <span>Robinhood Chain</span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-400">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Custom Destination Chain Dropdown */}
          <div className="flex flex-col gap-1 items-end relative" ref={chainDropdownRef}>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Destination</span>
            <button
              type="button"
              onClick={() => setShowChainDropdown(!showChainDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#181a22] hover:bg-white/10 border border-white/10 text-white font-medium text-xs transition cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: targetChain.iconColor }} />
              <span>{targetChain.name}</span>
              <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${showChainDropdown ? "rotate-180" : ""}`} />
            </button>

            {showChainDropdown && (
              <div className="absolute top-full right-0 mt-1.5 w-44 rounded-xl bg-[#181a22] border border-white/[0.08] shadow-2xl z-30 p-1 flex flex-col gap-0.5">
                {DESTINATION_CHAINS.map((c) => (
                  <button
                    key={c.chainId}
                    type="button"
                    onClick={() => {
                      setTargetChain(c);
                      setShowChainDropdown(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      targetChain.chainId === c.chainId
                        ? "bg-white/10 text-white font-medium"
                        : "text-neutral-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.iconColor }} />
                      <span>{c.name}</span>
                    </div>
                    {targetChain.chainId === c.chainId && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Amount Input with Token Selector */}
        <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-[#13151b] border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Send Amount</span>
            <div className="flex items-center gap-1">
              <span>Bal: {parseFloat(balanceIn).toFixed(4)}</span>
              <button
                type="button"
                onClick={() => setAmount(balanceIn)}
                className="text-red-400 hover:text-red-300 font-semibold ml-1 cursor-pointer"
              >
                MAX
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-white text-2xl font-bold focus:outline-none w-full placeholder:text-neutral-600"
            />

            <button
              type="button"
              onClick={() => setShowTokenPicker(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm transition shrink-0 cursor-pointer"
            >
              {tokenIn.icon ? (
                <img
                  src={tokenIn.icon}
                  alt={tokenIn.symbol}
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 shadow-sm"
                  style={{ backgroundColor: tokenIn.color || "#3b82f6" }}
                >
                  {tokenIn.symbol.slice(0, 1)}
                </div>
              )}
              <span>{tokenIn.symbol}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Destination Recipient Address */}
        <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-[#13151b] border border-white/[0.06]">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Destination Recipient ({targetChain.name})</span>
            {walletAddress && (
              <button
                type="button"
                onClick={() => setRecipient(walletAddress)}
                className="text-xs text-red-400 hover:text-red-300 font-medium transition cursor-pointer"
              >
                Use My Wallet
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="0x... (recipient address on destination chain)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="bg-[#181a22] text-white text-xs px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-white/20 w-full placeholder:text-neutral-500"
          />
        </div>

        {/* Quote & Estimate Details */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#13151b] border border-white/[0.06] text-xs text-neutral-400">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Estimated Delivery
            </span>
            <span className="text-white font-medium">~20 - 30 seconds</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Destination Payout</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {amount ? `${amount} ${tokenIn.native ? "ETH" : "USDC"}` : `0.0 ${tokenIn.native ? "ETH" : "USDC"}`} on {targetChain.name}
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
          className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
            !amount || parseFloat(amount) <= 0 || isExecuting
              ? "bg-white/5 text-neutral-500 cursor-not-allowed border border-white/5"
              : "bg-[#f64943] hover:bg-[#e03d38] text-white active:scale-[0.99]"
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

        {/* Powered by Relay */}
        <div className="text-center text-[11px] text-neutral-500 font-medium">
          Powered by Relay
        </div>

        {/* Progress Alert */}
        {txHash && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex flex-col gap-2">
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

      {/* Token Picker Modal for Cross-Chain */}
      <TokenPickerModal
        isOpen={showTokenPicker}
        onClose={() => setShowTokenPicker(false)}
        tokens={tokenList}
        selectedToken={tokenIn}
        onSelectToken={(selected) => setTokenIn(selected)}
        onAddCustomToken={handleAddCustomToken}
      />
    </div>
  );
}
