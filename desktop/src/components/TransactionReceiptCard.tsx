import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Fuel,
  ImageDown,
  Link2,
  Loader2,
  ShieldCheck,
  EyeOff,
} from "lucide-react";
import { renderReceiptImage, buildReceiptText } from "../lib/receiptImage";

export interface TransactionReceipt {
  hash: string;
  amount: string;
  asset: string;
  recipient: string;
  recipientLabel?: string;
  timestamp: number;
  gasless: boolean;
  stealth: boolean;
  feeEth?: string;
  feeUsd?: string;
}

interface TransactionReceiptCardProps {
  receipt: TransactionReceipt;
  explorerBaseUrl?: string;
  onDone: () => void;
  onSendAnother: () => void;
  onNotify?: (kind: "success" | "error", title: string, message: string) => void;
}

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function formatReceiptTime(timestamp: number): string {
  const d = new Date(timestamp);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} · ${time}`;
}

function shortenHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function TransactionReceiptCard({
  receipt,
  explorerBaseUrl = "https://robinhoodchain.blockscout.com",
  onDone,
  onSendAnother,
  onNotify,
}: TransactionReceiptCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const hasExplorerHash = Boolean(receipt.hash) && receipt.hash !== ZERO_HASH;
  const explorerUrl = `${explorerBaseUrl}/tx/${receipt.hash}`;

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(receipt.hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1800);
    } catch {
      /* clipboard unavailable — hash stays visible for manual copy */
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(
        hasExplorerHash ? explorerUrl : buildReceiptText(receipt, explorerUrl)
      );
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      onNotify?.("error", "Clipboard Unavailable", "Could not copy the receipt link.");
    }
  };

  const saveImage = async () => {
    setSavingImage(true);
    try {
      const blob = await renderReceiptImage(receipt, explorerUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `privatum-receipt-${receipt.hash.slice(2, 12)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onNotify?.(
        "success",
        "Receipt Image Saved",
        "A shareable PNG of this receipt was written to your downloads folder."
      );
    } catch (err: any) {
      console.error("Failed to render receipt image:", err);
      onNotify?.(
        "error",
        "Image Export Failed",
        err?.message || "Could not generate the receipt image."
      );
    } finally {
      setSavingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="relative flex flex-col items-center text-center pt-3 pb-1">
        <div
          className="absolute inset-x-0 -top-8 h-32 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(16,185,129,0.14), transparent 70%)",
          }}
        />
        <div className="relative w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-3">
          <Check className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h3 className="relative text-base font-semibold text-white tracking-tight">
          Transfer Signed
        </h3>
        <p className="relative text-[11px] text-slate-400 mt-1">
          Broadcast to Robinhood Chain · 2-of-3 threshold quorum
        </p>
      </div>

      {/* Amount hero */}
      <div className="rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/10 p-5 text-center">
        <div className="font-mono text-[28px] leading-none font-semibold text-white tracking-tight">
          -{receipt.amount}
          <span className="text-slate-400 text-xl ml-2">{receipt.asset}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Recipient
          </div>
          <div className="text-xs text-slate-200 break-all font-mono">
            {receipt.recipientLabel || receipt.recipient}
          </div>
        </div>
      </div>

      {/* Detail rows */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 divide-y divide-white/[0.06] text-xs overflow-hidden">
        <button
          type="button"
          onClick={copyHash}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03] transition text-left group"
          title={receipt.hash}
        >
          <span className="text-slate-400 shrink-0">Transaction</span>
          <span className="font-mono text-slate-200 group-hover:text-white inline-flex items-center gap-1.5 min-w-0 transition">
            <span className="truncate">{shortenHash(receipt.hash)}</span>
            {copiedHash ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
          </span>
        </button>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-slate-400">Timestamp</span>
          <span className="text-slate-200 font-mono">
            {formatReceiptTime(receipt.timestamp)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-slate-400">Network Fee</span>
          {receipt.gasless ? (
            <span className="text-emerald-400 font-medium inline-flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5" />
              Sponsored
            </span>
          ) : (
            <span className="text-slate-200 font-mono">
              {receipt.feeEth ? `approx. ${receipt.feeEth} ETH` : "Paid in ETH"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-slate-400">Privacy</span>
          {receipt.stealth ? (
            <span className="text-slate-200 font-medium inline-flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-slate-300" />
              Stealth (ERC-5564)
            </span>
          ) : (
            <span className="text-slate-200 font-medium inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
              Standard Transfer
            </span>
          )}
        </div>
      </div>

      {/* Share row */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={saveImage}
          disabled={savingImage}
          className="py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {savingImage ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Rendering...</span>
            </>
          ) : (
            <>
              <ImageDown className="w-3.5 h-3.5" />
              <span>Save Image</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={copyShareLink}
          className="py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Link Copied</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </>
          )}
        </button>
      </div>

      {/* Explorer */}
      {hasExplorerHash && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2"
        >
          <span>View on Explorer</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSendAnother}
          className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-300 font-semibold text-xs transition"
        >
          Send Another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-2.5 rounded-xl bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
