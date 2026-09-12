import React, { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Plus,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  ExternalLink,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  ArrowDownRight,
  Shield,
} from "lucide-react";
import QRCode from "qrcode";
import type { PrivatumWallet, UserPayLinkItem, PayLinkRouteMode } from "@privatumrh/robinhood-chain-sdk";
import {
  createPayLink,
  listUserPayLinks,
  cancelPayLink,
  checkAndSweepPayLink,
  DEFAULT_API_URL,
} from "@privatumrh/robinhood-chain-sdk";
import { PRIV_TOKEN_ADDRESS } from "../lib/tokens";

interface PayLinksTabProps {
  wallet: PrivatumWallet;
  addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
  onBalanceRefresh?: () => void;
}

const USDG_ADDRESS = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

export function PayLinksTab({ wallet, addToast, onBalanceRefresh }: PayLinksTabProps) {
  // The SDK's paylink module still defaults to a retired backend host, so pin
  // every call to the co-signer this wallet is actually talking to.
  const payLinkApiUrl = wallet?.apiUrl || DEFAULT_API_URL;

  const [paylinks, setPaylinks] = useState<UserPayLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Inline QR preview (v0.1.18) - rendered in the row, no separate modal
  const [expandedQrSlug, setExpandedQrSlug] = useState<string | null>(null);
  const [qrCache, setQrCache] = useState<Record<string, string>>({});

  // Form states
  const [tokenSymbol, setTokenSymbol] = useState<"USDG" | "ETH" | "PRIV">("USDG");
  const [amount, setAmount] = useState("");
  const [isFlexible, setIsFlexible] = useState(false);
  const [memo, setMemo] = useState("");
  const [expiryHours, setExpiryHours] = useState(72);
  const [routeMode, setRouteMode] = useState<PayLinkRouteMode>("direct");

  const [checkingSlug, setCheckingSlug] = useState<string | null>(null);

  const fetchPaylinks = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      const links = await listUserPayLinks(wallet.address, { apiUrl: payLinkApiUrl });
      setPaylinks(links);
    } catch (err: any) {
      console.error("Failed to load paylinks:", err);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address, payLinkApiUrl]);

  useEffect(() => {
    fetchPaylinks();
    const interval = setInterval(fetchPaylinks, 15000);
    return () => clearInterval(interval);
  }, [fetchPaylinks]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet?.address) return;

    if (!isFlexible && (!amount || Number(amount) <= 0)) {
      addToast("error", "Invalid Amount", "Please specify a positive amount or choose flexible amount.");
      return;
    }

    setSubmitting(true);
    try {
      let tokenAddress = USDG_ADDRESS;
      if (tokenSymbol === "ETH") tokenAddress = NATIVE_ETH;
      if (tokenSymbol === "PRIV") tokenAddress = PRIV_TOKEN_ADDRESS;

      const res = await createPayLink({
        recipient_address: wallet.address,
        token_address: tokenAddress as any,
        token_symbol: tokenSymbol,
        amount: isFlexible ? undefined : amount,
        memo: memo.trim() || undefined,
        route_mode: routeMode,
        expires_in_hours: expiryHours,
      }, { apiUrl: payLinkApiUrl });

      addToast("success", "Link Created", `Payment link ${res.slug} is ready to share.`);
      setShowCreateModal(false);
      setAmount("");
      setMemo("");
      setIsFlexible(false);
      await fetchPaylinks();

      // Surface the new link's QR inline straight away (v0.1.18)
      setExpandedQrSlug(res.slug);
      await ensureQr(res.slug);
    } catch (err: any) {
      addToast("error", "Creation Failed", err.message || "Could not generate payment link.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = `https://privatumrh.com/pay/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    addToast("info", "Link Copied", "Payment URL copied to clipboard.");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const ensureQr = useCallback(async (slug: string) => {
    if (qrCache[slug]) return;
    const url = `https://privatumrh.com/pay/${slug}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 240,
        margin: 1,
        color: { dark: "#0e121b", light: "#ffffff" },
      });
      setQrCache((prev) => ({ ...prev, [slug]: dataUrl }));
    } catch (err) {
      console.error("Failed to render pay link QR:", err);
    }
  }, [qrCache]);

  const handleToggleQr = async (link: UserPayLinkItem) => {
    if (expandedQrSlug === link.slug) {
      setExpandedQrSlug(null);
      return;
    }
    setExpandedQrSlug(link.slug);
    await ensureQr(link.slug);
  };

  const handleCheckSweep = async (slug: string) => {
    setCheckingSlug(slug);
    try {
      const res = await checkAndSweepPayLink(slug, { apiUrl: payLinkApiUrl });
      if (res.swept) {
        addToast("success", "Payment Swept", "Funds have been secured in your smart vault.");
        if (onBalanceRefresh) onBalanceRefresh();
      } else {
        addToast("info", "Checked", "No incoming payment detected yet.");
      }
      await fetchPaylinks();
    } catch (err: any) {
      addToast("error", "Check Failed", err.message || "Error checking on-chain balance.");
    } finally {
      setCheckingSlug(null);
    }
  };

  const handleCancelLink = async (slug: string) => {
    if (!confirm("Are you sure you want to cancel this disposable payment link?")) return;
    try {
      await cancelPayLink(slug, { apiUrl: payLinkApiUrl });
      addToast("info", "Link Cancelled", `Payment link ${slug} is now deactivated.`);
      await fetchPaylinks();
    } catch (err: any) {
      addToast("error", "Cancel Failed", err.message || "Could not cancel link.");
    }
  };

  const activeLinks = paylinks.filter((l) => l.status === "active" || l.status === "sweeping");
  const settledLinks = paylinks.filter((l) => l.status === "settled");

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131926] border border-[#1e293b] rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Link2 className="w-5 h-5 text-slate-300" />
            <span>Disposable Pay Links</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Create single-use payment links and QR codes. Payers send to a one-time burner address that sweeps directly into your vault.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Pay Link</span>
        </button>
      </div>

      {/* Active Links Section */}
      <div className="bg-[#131926] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Active Payment Links</h3>
          <button
            onClick={fetchPaylinks}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading payment links...</p>
        ) : activeLinks.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-[#1e293b] rounded-xl">
            <p className="text-xs text-slate-400 mb-2">No active payment links</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs text-white hover:underline cursor-pointer font-medium"
            >
              Generate your first disposable link
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {activeLinks.map((link) => (
              <div key={link.slug} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-white">
                      {link.expected_amount ? `${Number(link.expected_amount)} ${link.token_symbol}` : `Flexible (${link.token_symbol})`}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {link.slug}
                    </span>
                    {link.status === "sweeping" && (
                      <span className="text-xs text-amber-400">Sweeping...</span>
                    )}
                  </div>
                  {link.memo && (
                    <p className="text-xs text-slate-300 truncate max-w-md">
                      {link.memo}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                    <span>Deposit: {link.deposit_address.slice(0, 8)}...{link.deposit_address.slice(-6)}</span>
                    <span>Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopyLink(link.slug)}
                    className="px-3 py-1.5 rounded-lg bg-[#1e293b] text-slate-300 text-xs hover:text-white hover:bg-[#283548] transition-colors flex items-center gap-1.5"
                    title="Copy Shareable Link"
                  >
                    {copiedSlug === link.slug ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleToggleQr(link)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      expandedQrSlug === link.slug
                        ? "bg-white text-[#0e121b]"
                        : "bg-[#1e293b] text-slate-300 hover:text-white hover:bg-[#283548]"
                    }`}
                    title={expandedQrSlug === link.slug ? "Hide QR Code" : "Show QR Code"}
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCheckSweep(link.slug)}
                    disabled={checkingSlug === link.slug}
                    className="px-3 py-1.5 rounded-lg bg-[#1e293b] text-slate-300 text-xs hover:text-white hover:bg-[#283548] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Check On-Chain Balance & Sweep"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingSlug === link.slug ? "animate-spin" : ""}`} />
                    <span>Check Sweep</span>
                  </button>

                  <button
                    onClick={() => handleCancelLink(link.slug)}
                    className="p-1.5 rounded-lg bg-[#1e293b] text-slate-400 hover:text-rose-400 hover:bg-[#283548] transition-colors"
                    title="Cancel Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline QR preview */}
              {expandedQrSlug === link.slug && (
                <div className="mt-4 rounded-xl bg-[#0e121b] border border-[#1e293b] p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="bg-white rounded-xl p-2.5 shrink-0">
                    {qrCache[link.slug] ? (
                      <img
                        src={qrCache[link.slug]}
                        alt={`QR code for pay link ${link.slug}`}
                        className="w-36 h-36 block"
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left space-y-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        Scan to pay
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {link.expected_amount
                          ? `${Number(link.expected_amount)} ${link.token_symbol}`
                          : `Flexible (${link.token_symbol})`}
                      </div>
                      {link.memo && (
                        <p className="text-xs text-slate-400 mt-0.5 break-words">{link.memo}</p>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-slate-400 break-all">
                      https://privatumrh.com/pay/{link.slug}
                    </div>

                    <button
                      onClick={() => handleCopyLink(link.slug)}
                      className="px-3 py-1.5 rounded-lg bg-[#1e293b] text-slate-300 text-xs hover:text-white hover:bg-[#283548] transition-colors inline-flex items-center gap-1.5"
                    >
                      {copiedSlug === link.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settled History Section */}
      <div className="bg-[#131926] border border-[#1e293b] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Settled History</h3>

        {settledLinks.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No settled payments yet.</p>
        ) : (
          <div className="divide-y divide-[#1e293b]">
            {settledLinks.map((link) => (
              <div key={link.slug} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      +{link.swept_amount || link.expected_amount} {link.token_symbol}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {link.slug}
                    </span>
                  </div>
                  {link.memo && (
                    <p className="text-slate-400">{link.memo}</p>
                  )}
                  <span className="text-[11px] text-slate-500 block">
                    {link.settled_at ? new Date(link.settled_at).toLocaleString() : ""}
                  </span>
                </div>

                {link.sweep_tx_hash && (
                  <a
                    href={`https://explorer.mainnet.chain.robinhood.com/tx/${link.sweep_tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Pay Link Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131926] border border-[#1e293b] rounded-2xl w-full max-w-md p-6 relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
              <h3 className="text-base font-bold text-white tracking-tight">
                Create Disposable Pay Link
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-4">
              {/* Asset Selection */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Payment Asset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["USDG", "ETH", "PRIV"] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setTokenSymbol(sym)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        tokenSymbol === sym
                          ? "bg-white text-slate-900 border-white"
                          : "bg-[#0e131f] border-[#1e293b] text-slate-300 hover:bg-[#1e293b]"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400 font-medium">
                    Requested Amount
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFlexible}
                      onChange={(e) => setIsFlexible(e.target.checked)}
                      className="rounded border-[#1e293b] bg-[#0e131f]"
                    />
                    <span>Any amount</span>
                  </label>
                </div>
                {!isFlexible && (
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required={!isFlexible}
                      className="w-full bg-[#0e131f] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-slate-400 font-mono"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                      {tokenSymbol}
                    </span>
                  </div>
                )}
              </div>

              {/* Memo / Description */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Memo / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #104, Dinner split"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={100}
                  className="w-full bg-[#0e131f] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-slate-400"
                />
              </div>

              {/* Expiration Hours */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Link Expiration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "24h", hours: 24 },
                    { label: "3 Days", hours: 72 },
                    { label: "7 Days", hours: 168 },
                    { label: "30 Days", hours: 720 },
                  ].map((item) => (
                    <button
                      key={item.hours}
                      type="button"
                      onClick={() => setExpiryHours(item.hours)}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                        expiryHours === item.hours
                          ? "bg-[#1e293b] border-slate-400 text-white"
                          : "bg-[#0e131f] border-[#1e293b] text-slate-400 hover:bg-[#1e293b]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Mode: Direct vs Pool Shielded */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Privacy Sweep Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRouteMode("direct")}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      routeMode === "direct"
                        ? "bg-[#1e293b] border-slate-400 text-white"
                        : "bg-[#0e131f] border-[#1e293b] text-slate-400 hover:bg-[#1e293b]"
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Direct Sweep</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Burner sweeps directly to vault</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRouteMode("pool_shielded")}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      routeMode === "pool_shielded"
                        ? "bg-[#1e293b] border-slate-400 text-white"
                        : "bg-[#0e131f] border-[#1e293b] text-slate-400 hover:bg-[#1e293b]"
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">Pool-Shielded</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Routes through pool to unlink graph</div>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-white text-slate-900 font-semibold text-xs hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Generating Link..." : "Generate Disposable Link"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
