import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Copy, Check, ExternalLink, ArrowRight, Wallet, Shield } from "lucide-react";

export const Route = createFileRoute("/pay/$slug")({
  component: PayLinkComponent,
});

interface PayLinkData {
  slug: string;
  token_address: string;
  token_symbol: string;
  expected_amount: string | null;
  memo: string | null;
  deposit_address: string;
  route_mode: string;
  status: "active" | "sweeping" | "settled" | "expired" | "cancelled";
  received_amount?: string | null;
  swept_amount?: string | null;
  sweep_tx_hash?: string | null;
  expires_at: string;
  settled_at?: string | null;
  created_at: string;
}

const ROBINHOOD_CHAIN_ID_HEX = "0x1237"; // 4663
const ROBINHOOD_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
// Canonical co-signer origin, matching DEFAULT_API_URL in the SDK. The previous
// fallback pointed at a Render host that no longer serves the API, and
// VITE_BACKEND_URL is not set in the deployed environment, so the fallback is
// what production actually uses.
const API_BASE = import.meta.env.VITE_BACKEND_URL || "https://api.privatumrh.com";

// Minimal ERC20 ABI for transfer(address,uint256)
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

function encodeErc20Transfer(to: string, amountWei: bigint): string {
  const cleanTo = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const cleanAmount = amountWei.toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER_SELECTOR}${cleanTo}${cleanAmount}`;
}

function parseUnits(val: string | number, decimals = 18): bigint {
  const [whole, fraction = ""] = String(val).split(".");
  const fracPadded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded);
}

function PayLinkComponent() {
  const { slug } = Route.useParams();
  const [paylink, setPaylink] = useState<PayLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [walletPaying, setWalletPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch paylink metadata
  const fetchPaylink = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/paylinks/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("This payment link does not exist or has been removed.");
        } else {
          setError("Failed to load payment details.");
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success && data.paylink) {
        setPaylink(data.paylink);
      }
    } catch {
      setError("Network connection issue while loading payment details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaylink();

    // Trigger check/sweep and poll status every 4 seconds
    pollTimerRef.current = setInterval(async () => {
      try {
        await fetch(`${API_BASE}/v1/paylinks/check/${encodeURIComponent(slug)}`, {
          method: "POST",
        }).catch(() => null);

        const res = await fetch(`${API_BASE}/v1/paylinks/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.paylink) {
            setPaylink(data.paylink);
            if (data.paylink.status === "settled") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            }
          }
        }
      } catch {
        // Polling failure silent fallback
      }
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [slug]);

  // Generate QR code when deposit address is loaded
  useEffect(() => {
    if (paylink?.deposit_address) {
      QRCode.toDataURL(paylink.deposit_address, {
        width: 220,
        margin: 1,
        color: {
          dark: "#0e121b",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => null);
    }
  }, [paylink?.deposit_address]);

  const copyAddress = () => {
    if (!paylink?.deposit_address) return;
    navigator.clipboard.writeText(paylink.deposit_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Injected Wallet Payment (MetaMask, Coinbase, Rainbow)
  const handlePayWithWallet = async () => {
    if (!paylink) return;
    const eth = (window as unknown as { ethereum?: any }).ethereum;

    if (!eth) {
      setPayError("No Web3 wallet found. Please copy the deposit address to pay manually.");
      return;
    }

    setWalletPaying(true);
    setPayError(null);

    try {
      // 1. Request accounts
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const sender = accounts[0];

      // 2. Check/switch network to Robinhood Chain
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ROBINHOOD_CHAIN_ID_HEX }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ROBINHOOD_CHAIN_ID_HEX,
                chainName: "Robinhood Chain",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [ROBINHOOD_RPC_URL],
                blockExplorerUrls: ["https://explorer.mainnet.chain.robinhood.com"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const isNative =
        paylink.token_address === "0x0000000000000000000000000000000000000000";
      const amount = paylink.expected_amount ? Number(paylink.expected_amount) : 1;

      let hash = "";
      if (isNative) {
        const valWei = parseUnits(amount, 18);
        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: sender,
              to: paylink.deposit_address,
              value: "0x" + valWei.toString(16),
            },
          ],
        });
      } else {
        const decimals = paylink.token_symbol === "USDC" || paylink.token_symbol === "USDT" ? 6 : 18;
        const amountWei = parseUnits(amount, decimals);
        const data = encodeErc20Transfer(paylink.deposit_address, amountWei);

        hash = await eth.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: sender,
              to: paylink.token_address,
              data,
              value: "0x0",
            },
          ],
        });
      }

      setTxHash(hash);
      // Trigger instant check
      await fetch(`${API_BASE}/v1/paylinks/check/${encodeURIComponent(slug)}`, {
        method: "POST",
      }).catch(() => null);
    } catch (err: any) {
      console.error("Wallet pay error:", err);
      setPayError(err.message || "Failed to complete wallet payment");
    } finally {
      setWalletPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f5f8] text-[#0e121b] font-['Inter',sans-serif]">
        <p className="text-sm text-[#687182]">Loading payment request...</p>
      </div>
    );
  }

  if (error || !paylink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f5f8] text-[#0e121b] font-['Inter',sans-serif] px-4">
        <div className="max-w-md w-full bg-white border border-[rgba(14,18,27,0.08)] rounded-2xl p-8 text-center shadow-[0_18px_45px_rgba(26,31,43,0.06)]">
          <h1 className="text-xl font-semibold tracking-tight text-[#0e121b] mb-2">
            Payment Not Found
          </h1>
          <p className="text-sm text-[#687182] mb-6">
            {error || "This payment link is inactive or could not be found."}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#0e121b] text-white text-xs font-semibold hover:bg-[#1f2633] transition-colors"
          >
            Return to Privatum
          </a>
        </div>
      </div>
    );
  }

  const isSettled = paylink.status === "settled";
  const isSweeping = paylink.status === "sweeping";
  const isExpired = paylink.status === "expired";
  const isCancelled = paylink.status === "cancelled";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f5f8] text-[#0e121b] font-['Inter',sans-serif] p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-[rgba(14,18,27,0.08)] rounded-2xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(14,18,27,0.07)]">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 border-b border-[rgba(14,18,27,0.08)]">
          <a href="/" className="inline-flex items-center gap-2.5 text-[#0e121b] font-semibold text-base tracking-tight">
            <span className="w-6 h-6 rounded-md bg-[#0e121b] text-white grid place-items-center text-xs font-bold">
              P
            </span>
            <span>Privatum</span>
          </a>
          <span className="text-xs text-[#687182]">Robinhood Chain</span>
        </div>

        {/* Settled Success State */}
        {isSettled ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#eaf8ef] text-[#168247] grid place-items-center mx-auto mb-4">
              <Check className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#0e121b] mb-2">
              Payment Completed
            </h2>
            <p className="text-sm text-[#687182] mb-6">
              The funds have been received and secured in the private vault.
            </p>

            <div className="bg-[#fafbfc] border border-[rgba(14,18,27,0.08)] rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-xs">
                <span className="text-[#687182]">Amount Settled</span>
                <span className="font-semibold text-[#0e121b]">
                  {paylink.swept_amount || paylink.expected_amount || "Confirmed"}{" "}
                  {paylink.token_symbol}
                </span>
              </div>
              {paylink.memo && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#687182]">Memo</span>
                  <span className="font-medium text-[#0e121b] truncate max-w-[200px]">
                    {paylink.memo}
                  </span>
                </div>
              )}
              {paylink.settled_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#687182]">Settled At</span>
                  <span className="text-[#0e121b]">
                    {new Date(paylink.settled_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {paylink.sweep_tx_hash && (
              <a
                href={`https://explorer.mainnet.chain.robinhood.com/tx/${paylink.sweep_tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#687182] hover:text-[#0e121b] transition-colors"
              >
                <span>View settlement on explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : isExpired || isCancelled ? (
          <div className="py-8 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-[#0e121b] mb-2">
              {isExpired ? "Payment Link Expired" : "Payment Link Cancelled"}
            </h2>
            <p className="text-sm text-[#687182] mb-6">
              This disposable link is no longer accepting deposits.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#0e121b] text-white text-xs font-semibold hover:bg-[#1f2633] transition-colors"
            >
              Back to Home
            </a>
          </div>
        ) : (
          /* Active Payment Flow */
          <div className="pt-6">
            {/* Payment Amount & Memo */}
            <div className="text-center mb-6">
              <span className="text-xs uppercase tracking-wider text-[#687182] block mb-1">
                Amount to pay
              </span>
              <div className="text-3xl font-bold tracking-tight text-[#0e121b]">
                {paylink.expected_amount
                  ? `${Number(paylink.expected_amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })} ${paylink.token_symbol}`
                  : `Any Amount (${paylink.token_symbol})`}
              </div>
              {paylink.memo && (
                <p className="text-sm text-[#687182] mt-1.5 font-normal">
                  {paylink.memo}
                </p>
              )}
            </div>

            {/* Privacy Guarantee Note */}
            <div className="border border-[rgba(14,18,27,0.08)] bg-[#fafbfc] rounded-xl p-3.5 mb-6 text-xs text-[#687182] space-y-1">
              <div className="flex items-center justify-between">
                <span>Recipient</span>
                <span className="font-medium text-[#0e121b]">Protected Private Account</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Network</span>
                <span className="font-medium text-[#0e121b]">Robinhood Chain</span>
              </div>
            </div>

            {/* QR Code Container */}
            {qrDataUrl && (
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="p-3 bg-white border border-[rgba(14,18,27,0.08)] rounded-xl shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt="Payment QR Code"
                    className="w-44 h-44 block rounded-lg"
                  />
                </div>
                <span className="text-[11px] text-[#687182] mt-2">
                  Scan with mobile wallet
                </span>
              </div>
            )}

            {/* One-Time Deposit Address Box */}
            <div className="mb-6">
              <span className="text-xs text-[#687182] block mb-1.5">
                Send to this disposable address
              </span>
              <div className="flex items-center justify-between gap-2 p-2.5 bg-[#fafbfc] border border-[rgba(14,18,27,0.08)] rounded-xl">
                <span className="font-mono text-xs text-[#0e121b] truncate pl-1">
                  {paylink.deposit_address}
                </span>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[rgba(14,18,27,0.08)] text-xs text-[#0e121b] hover:bg-[#f3f5f8] transition-colors shrink-0 font-medium"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#168247]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pay With Injected Wallet Button */}
            <div className="space-y-3">
              <button
                onClick={handlePayWithWallet}
                disabled={walletPaying || isSweeping}
                className="w-full py-3 px-4 rounded-xl bg-[#0e121b] text-white text-xs font-semibold hover:bg-[#1f2633] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>
                  {walletPaying
                    ? "Connecting & Sending..."
                    : `Pay ${paylink.expected_amount ? `${paylink.expected_amount} ${paylink.token_symbol}` : paylink.token_symbol} with Wallet`}
                </span>
              </button>

              {payError && (
                <p className="text-xs text-[#c23a2f] text-center mt-2">
                  {payError}
                </p>
              )}

              {txHash && (
                <div className="text-center mt-2 text-xs text-[#168247]">
                  Transaction broadcasted. Detecting confirmation...
                </div>
              )}
            </div>

            {/* Live Status Indicator */}
            <div className="mt-6 pt-4 border-t border-[rgba(14,18,27,0.08)] flex items-center justify-center gap-2 text-xs text-[#687182]">
              <span className="w-2 h-2 rounded-full bg-[#f64b43] animate-pulse" />
              <span>
                {isSweeping
                  ? "Deposit detected. Sweeping into vault..."
                  : "Awaiting payment on-chain"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
