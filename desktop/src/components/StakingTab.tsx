import React, { useState, useEffect, useCallback } from "react";
import {
  Zap,
  ShieldCheck,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Coins,
  Sparkles,
  ArrowDownLeft,
} from "lucide-react";
import { parseUnits, formatUnits, encodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import type { PrivatumWallet } from "@privatumrh/robinhood-chain-sdk";
import { erc20Abi } from "@privatumrh/robinhood-chain-sdk";
import { executeAccountCall } from "../lib/execute";
import { PRIV_TOKEN_ADDRESS } from "../lib/tokens";
import {
  calculateStakingTier,
  getStakingConfig,
  getStakingStatus,
  recordStake,
  renewStaking,
  unstakePriv,
} from "@privatumrh/robinhood-chain-sdk";

interface StakingTabProps {
  wallet: PrivatumWallet;
  shardAPrivKey?: string;
  client: PublicClient;
  addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
  onStakingUpdated?: () => void;
}

export function StakingTab({
  wallet,
  shardAPrivKey,
  client,
  addToast,
  onStakingUpdated,
}: StakingTabProps) {
  const [loading, setLoading] = useState(true);
  const [poolWallet, setPoolWallet] = useState<Address>("0xf5370a080A8c8Eed95E71982b228A3C0BdEfF41f");
  const [privBalance, setPrivBalance] = useState<string>("0.00");
  const [status, setStatus] = useState<any>(null);

  const [stakeInput, setStakeInput] = useState<string>("");
  const [unstakeInput, setUnstakeInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const [isStaking, setIsStaking] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);

  // Fetch token balance and staking status
  const refreshData = useCallback(async () => {
    if (!wallet) return;
    try {
      // 1. Fetch Staking Config
      const config = await getStakingConfig(wallet.apiUrl).catch(() => null);
      if (config?.platformPoolWallet) {
        setPoolWallet(config.platformPoolWallet);
      }

      // 2. Fetch Staking Status
      const st = await getStakingStatus(wallet.address, wallet.apiUrl).catch(() => null);
      setStatus(st);

      // 3. Fetch on-chain $PRIV balance
      try {
        const bal = await client.readContract({
          address: PRIV_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.address],
        });
        setPrivBalance(parseFloat(formatUnits(bal, 18)).toFixed(2));
      } catch (balErr) {
        // Fallback if token not deployed on current testnet RPC
        setPrivBalance("0.00");
      }
    } catch (err) {
      console.warn("[StakingTab] Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [wallet, client]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Preview Tier from input
  const previewAmount = parseFloat(stakeInput) || 0;
  const previewTier = calculateStakingTier(previewAmount);

  // 1. Stake $PRIV
  const handleStake = async () => {
    const amountNum = parseFloat(stakeInput);
    if (isNaN(amountNum) || amountNum < 10000) {
      addToast("error", "Minimum 10,000 $PRIV Required", "Please enter at least 10,000 $PRIV to activate gasless transactions.");
      return;
    }

    setIsStaking(true);
    try {
      const parsedUnits = parseUnits(stakeInput, 18);

      // Encode ERC-20 transfer to Platform Pool Wallet
      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [poolWallet, parsedUnits],
      });

      // Submit transfer via smart account
      const txHash = await executeAccountCall({
        wallet,
        shardAPrivKey,
        client,
        target: PRIV_TOKEN_ADDRESS,
        value: 0n,
        data: transferData,
        sponsor: status?.isStaked,
      });

      // Record stake in protocol database
      await recordStake({
        wallet,
        txHash,
        amount: amountNum,
      });

      addToast(
        "success",
        "Stake Successful",
        `Staked ${amountNum.toLocaleString()} $PRIV. You now have 100% gasless transactions sponsored by the protocol!`
      );
      setStakeInput("");
      await refreshData();
      onStakingUpdated?.();
    } catch (err: any) {
      console.error("[StakingTab] Stake error:", err);
      addToast("error", "Staking Failed", err.message || "Failed to stake tokens.");
    } finally {
      setIsStaking(false);
    }
  };

  // 2. Manual Monthly Renewal
  const handleRenew = async () => {
    if (!status?.stakedAmount || status.stakedAmount < 10000) {
      addToast("error", "Cannot Renew", "You need at least 10,000 $PRIV staked to renew your gasless pass.");
      return;
    }

    setIsRenewing(true);
    try {
      await renewStaking(wallet);
      addToast(
        "success",
        "Renewed for 30 Days",
        "Your monthly gasless pass and transaction quota have been successfully reset."
      );
      await refreshData();
      onStakingUpdated?.();
    } catch (err: any) {
      console.error("[StakingTab] Renewal error:", err);
      addToast("error", "Renewal Failed", err.message || "Failed to renew staking.");
    } finally {
      setIsRenewing(false);
    }
  };

  // 3. Unstake $PRIV
  const handleUnstake = async () => {
    const amountNum = parseFloat(unstakeInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast("error", "Invalid Amount", "Please enter a valid amount of $PRIV to unstake.");
      return;
    }

    if (amountNum > (status?.stakedAmount || 0)) {
      addToast("error", "Exceeds Balance", `You only have ${(status?.stakedAmount || 0).toLocaleString()} $PRIV staked.`);
      return;
    }

    setIsUnstaking(true);
    try {
      await unstakePriv({
        wallet,
        amount: amountNum,
      });
      addToast(
        "success",
        "Unstaked Successfully",
        `Unstaked ${amountNum.toLocaleString()} $PRIV. Tokens have been returned to your wallet.`
      );
      setUnstakeInput("");
      await refreshData();
      onStakingUpdated?.();
    } catch (err: any) {
      console.error("[StakingTab] Unstake error:", err);
      addToast("error", "Unstaking Failed", err.message || "Failed to unstake tokens.");
    } finally {
      setIsUnstaking(false);
    }
  };

  const isStaked = status?.isStaked;
  const quotaUsed = status?.quotaUsed || 0;
  const monthlyQuota = status?.monthlyQuota || 0;
  const isUnlimited = monthlyQuota === -1;
  const quotaPercent = isUnlimited ? 0 : Math.min(100, Math.round((quotaUsed / (monthlyQuota || 1)) * 100));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-5xl mx-auto space-y-6">
      {/* Title & Introduction */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400 fill-amber-400/20" />
            Stake $PRIV to Go Gasless
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Stake your $PRIV tokens each month to unlock 100% free transactions sponsored by the protocol.
          </p>
        </div>
        <button
          onClick={refreshData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors border border-white/10"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Main Status Hero Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl p-6 border transition-all ${
          isStaked
            ? "bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/90 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
            : "bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950 border-white/10"
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isStaked
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isStaked ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                {isStaked ? "100% Gasless Active" : "Gasless Inactive"}
              </span>
              {isStaked && (
                <span className="text-xs font-medium text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                  {status.tier}
                </span>
              )}
            </div>

            <div className="text-3xl font-bold text-white tracking-tight">
              {isStaked ? (
                <span>
                  {(status?.stakedAmount || 0).toLocaleString()}{" "}
                  <span className="text-lg font-normal text-slate-400">$PRIV Staked</span>
                </span>
              ) : (
                <span>Zero Gas Fees on Transfers & Swaps</span>
              )}
            </div>

            <p className="text-sm text-slate-300 max-w-xl">
              {isStaked
                ? `You do not need native ETH for gas. The protocol sponsors your transactions on Robinhood Chain.`
                : "Stake at least 10,000 $PRIV to stop paying network fees. You can unstake your tokens anytime."}
            </p>
          </div>

          {/* Quota & Action Widget */}
          {isStaked ? (
            <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/10">
              <div className="space-y-1.5 min-w-[160px]">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Monthly Quota</span>
                  <span className="text-white font-semibold">
                    {isUnlimited ? "Unlimited" : `${quotaUsed} / ${monthlyQuota}`}
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    {status.daysRemaining > 0
                      ? `${status.daysRemaining} days remaining in pass`
                      : "Expired"}
                  </span>
                </div>
              </div>

              {/* Renewal Button */}
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  status.canRenew
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 animate-pulse"
                    : "bg-white/10 hover:bg-white/15 text-white"
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRenewing ? "animate-spin" : ""}`} />
                {isRenewing ? "Renewing..." : "Renew (30 Days)"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setStakeInput("10000");
                  setActiveTab("stake");
                }}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                Stake 10k $PRIV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Staking Actions & Tier Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stake / Unstake Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            {/* Tab switch */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-5">
              <button
                onClick={() => setActiveTab("stake")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === "stake"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                Stake $PRIV
              </button>
              <button
                onClick={() => setActiveTab("unstake")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === "unstake"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                Unstake $PRIV
              </button>
            </div>

            {activeTab === "stake" ? (
              /* Stake Form */
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Enter Amount to Stake</span>
                  <span>
                    Available in Wallet: <b className="text-white">{privBalance} $PRIV</b>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-lg font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    $PRIV
                  </span>
                </div>

                {/* Quick select chips */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "10k (25 tx)", val: "10000" },
                    { label: "50k (100 tx)", val: "50000" },
                    { label: "100k (175 tx)", val: "100000" },
                    { label: "1M (Unlimited)", val: "1000000" },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      onClick={() => setStakeInput(chip.val)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 text-center transition-colors truncate"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Tier Prediction Card */}
                {previewAmount > 0 && (
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Calculated Tier:</span>
                      <span className="text-white font-semibold">{previewTier.tierName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Sponsored Transactions:</span>
                      <span className="text-emerald-400 font-semibold">
                        {previewTier.monthlyQuota === -1 ? "Unlimited" : `${previewTier.monthlyQuota} per month`}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Duration:</span>
                      <span className="text-slate-300">30 Days (Renewable each month)</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStake}
                  disabled={isStaking || previewAmount < 10000}
                  className="w-full py-3.5 rounded-xl bg-[#B91C3B] hover:bg-[#ff574f] disabled:bg-white/10 disabled:text-slate-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {isStaking ? "Staking $PRIV..." : "Stake $PRIV & Activate Gasless"}
                </button>
              </div>
            ) : (
              /* Unstake Form */
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Enter Amount to Unstake</span>
                  <span>
                    Currently Staked: <b className="text-white">{(status?.stakedAmount || 0).toLocaleString()} $PRIV</b>
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={unstakeInput}
                    onChange={(e) => setUnstakeInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-lg font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-400/50 transition-colors"
                  />
                  <button
                    onClick={() => setUnstakeInput(String(status?.stakedAmount || 0))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 rounded border border-amber-400/20 hover:bg-amber-400/20"
                  >
                    MAX
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  When you unstake, your $PRIV tokens are transferred back to your wallet address. If your remaining staked balance falls below 10,000 $PRIV, gasless transaction sponsorship will pause.
                </p>

                <button
                  onClick={handleUnstake}
                  disabled={isUnstaking || !unstakeInput || parseFloat(unstakeInput) <= 0}
                  className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-white/5 disabled:text-slate-600 text-white font-bold text-sm transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  {isUnstaking ? "Unstaking..." : "Unstake $PRIV to Wallet"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Staking Tier Model Table & Explainer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Monthly Staking Tiers
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                <div>
                  <div className="font-semibold text-white">Tier 1</div>
                  <div className="text-[11px] text-slate-400">10,000 $PRIV</div>
                </div>
                <div className="font-mono font-bold text-emerald-400">25 free txns/mo</div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                <div>
                  <div className="font-semibold text-white">Tier 2</div>
                  <div className="text-[11px] text-slate-400">50,000 $PRIV</div>
                </div>
                <div className="font-mono font-bold text-emerald-400">100 free txns/mo</div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                <div>
                  <div className="font-semibold text-white">+50k Step</div>
                  <div className="text-[11px] text-slate-400">Every extra 50,000 $PRIV</div>
                </div>
                <div className="font-mono font-bold text-emerald-400">+75 free txns/mo</div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div>
                  <div className="font-semibold text-amber-300">Tier Unlimited</div>
                  <div className="text-[11px] text-slate-400">1,000,000+ $PRIV</div>
                </div>
                <div className="font-mono font-bold text-amber-300">Unlimited txns</div>
              </div>
            </div>

            {/* Explainer / FAQ */}
            <div className="pt-2 border-t border-white/10 space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <b className="text-white">You own your tokens:</b> Staking transfers tokens into the protocol pool. You can unstake anytime.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <b className="text-white">Manual monthly renewal:</b> Click "Renew" once every 30 days to reset your free transactions.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <b className="text-white">Zero ETH required:</b> Send USDG, execute private stealth payments, and swap without needing ETH for gas.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
