import React, { useEffect, useState } from "react";
import { Check, Copy, Download, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { exportTransactionJson, type OfflineTransaction } from "../lib/offlineOutbox";

interface Props {
  isOpen: boolean;
  tx: OfflineTransaction | null;
  onClose: () => void;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export function AirGapQrModal({ isOpen, tx, onClose, onNotify }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedHex, setCopiedHex] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (!isOpen || !tx) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(tx.rawSignedTx, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 6,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Failed to generate Air-Gap QR code:", err));
  }, [isOpen, tx]);

  if (!isOpen || !tx) return null;

  const handleCopyHex = () => {
    navigator.clipboard.writeText(tx.rawSignedTx);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
    onNotify?.("success", "Raw Hex Copied", "Serialized signed transaction copied to clipboard.");
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(tx.txHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
    onNotify?.("success", "Tx Hash Copied", "Offline transaction hash copied to clipboard.");
  };

  const handleDownloadJson = () => {
    const jsonStr = exportTransactionJson(tx);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offline-tx-nonce-${tx.nonce}-${tx.asset.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.("success", "Export Complete", "Signed transaction JSON downloaded successfully.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Air-Gap Signed Transaction</h2>
              <p className="text-xs text-zinc-400">Scan or broadcast serialized payload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 flex flex-col items-center">
          {qrDataUrl ? (
            <div className="p-3 bg-white rounded-xl shadow-lg border border-zinc-200">
              <img
                src={qrDataUrl}
                alt="Air-Gap Signed Transaction QR"
                className="w-56 h-56 object-contain"
              />
            </div>
          ) : (
            <div className="w-56 h-56 rounded-xl bg-zinc-900 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800">
              Generating QR code...
            </div>
          )}
          <p className="text-[11px] text-zinc-400 mt-2 text-center max-w-xs">
            Scan this raw payload with any online node, relayer, or watch-only wallet to broadcast onchain.
          </p>
        </div>

        <div className="space-y-2.5 bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800/80 text-xs">
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-500">Transfer:</span>
            <span className="font-semibold text-zinc-200">
              {tx.amount} {tx.asset}
            </span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-500">Recipient:</span>
            <span className="font-mono text-[11px] text-zinc-300">
              {tx.recipient.slice(0, 10)}...{tx.recipient.slice(-8)}
              {tx.recipientLabel ? ` (${tx.recipientLabel})` : ""}
            </span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-500">Assigned Nonce:</span>
            <span className="font-mono font-medium text-amber-400">#{tx.nonce}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-500">Target Chain:</span>
            <span className="font-mono text-[11px] text-zinc-400">Robinhood Chain (ID {tx.chainId})</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-500">Computed Hash:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-zinc-400">
                {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
              </span>
              <button
                onClick={handleCopyHash}
                className="text-zinc-400 hover:text-zinc-200 p-0.5"
                title="Copy Transaction Hash"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1 text-[11px] text-zinc-400">
            <span>Raw Serialized Hex</span>
            <span>{tx.rawSignedTx.length / 2} bytes</span>
          </div>
          <div className="relative">
            <textarea
              readOnly
              rows={2}
              value={tx.rawSignedTx}
              className="w-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-300 focus:outline-none select-all resize-none"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyHex}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
          >
            {copiedHex ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedHex ? "Copied Raw Hex" : "Copy Raw Hex"}</span>
          </button>
          <button
            onClick={handleDownloadJson}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-400 border border-amber-500/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download .tx JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
