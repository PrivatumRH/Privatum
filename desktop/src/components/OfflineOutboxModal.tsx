import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Radio,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { robinhoodChain } from "@privatumrh/robinhood-chain-sdk";
import type { OfflineTransaction } from "../lib/offlineOutbox";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  outbox: OfflineTransaction[];
  isOnline: boolean;
  forceAirGap: boolean;
  onToggleForceAirGap: (enabled: boolean) => void;
  onBroadcastTx: (tx: OfflineTransaction) => Promise<void>;
  onBroadcastAll: () => Promise<void>;
  onRemoveTx: (txId: string) => void;
  onClearHistory: () => void;
  onOpenAirGapQr: (tx: OfflineTransaction) => void;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
  isBroadcastingAll?: boolean;
  broadcastingTxId?: string | null;
}

export function OfflineOutboxModal({
  isOpen,
  onClose,
  walletAddress,
  outbox,
  isOnline,
  forceAirGap,
  onToggleForceAirGap,
  onBroadcastTx,
  onBroadcastAll,
  onRemoveTx,
  onClearHistory,
  onOpenAirGapQr,
  onNotify,
  isBroadcastingAll,
  broadcastingTxId,
}: Props) {
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  if (!isOpen) return null;

  const queuedTxs = outbox.filter((t) => t.status === "queued");
  const finishedTxs = outbox.filter((t) => t.status !== "queued");

  const handleCopyRaw = (tx: OfflineTransaction) => {
    navigator.clipboard.writeText(tx.rawSignedTx);
    setCopiedTxId(tx.id);
    setTimeout(() => setCopiedTxId(null), 2000);
    onNotify?.("success", "Raw Hex Copied", "Serialized transaction copied to clipboard.");
  };

  const isNetworkReadyToBroadcast = isOnline && !forceAirGap;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">Offline Outbox & Air-Gap Engine</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {queuedTxs.length} Queued
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Sign transactions in isolation and stage for delayed settlement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar & Controls */}
        <div className="mt-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Network Status:</span>
              {forceAirGap ? (
                <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Radio className="w-3.5 h-3.5" />
                  Forced Air-Gap
                </span>
              ) : isOnline ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <Wifi className="w-3.5 h-3.5" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={forceAirGap}
                onChange={(e) => onToggleForceAirGap(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-400 focus:ring-offset-zinc-900"
              />
              <span className="font-medium">Force Air-Gap Mode</span>
            </label>
          </div>
        </div>

        {/* Batch Operations Bar */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {queuedTxs.length === 0
              ? "Outbox is clear"
              : `${queuedTxs.length} pending transfer${queuedTxs.length === 1 ? "" : "s"} awaiting broadcast`}
          </div>
          <div className="flex items-center gap-2">
            {finishedTxs.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-xs text-zinc-400 hover:text-zinc-200 py-1 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                Clear History
              </button>
            )}
            <button
              onClick={() => onBroadcastAll()}
              disabled={!isNetworkReadyToBroadcast || queuedTxs.length === 0 || isBroadcastingAll}
              className={`flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border transition-all ${
                isNetworkReadyToBroadcast && queuedTxs.length > 0 && !isBroadcastingAll
                  ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-400 font-semibold"
                  : "bg-zinc-800/60 text-zinc-500 border-zinc-800 cursor-not-allowed"
              }`}
            >
              {isBroadcastingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Broadcasting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Broadcast All ({queuedTxs.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Transaction Cards List */}
        <div className="mt-4 max-h-80 overflow-y-auto space-y-2.5 pr-1">
          {outbox.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <Radio className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm font-medium text-zinc-400">No transactions in outbox</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Transactions initiated while offline or with Air-Gap mode active are cryptographically signed locally and safely staged here.
              </p>
            </div>
          ) : (
            outbox.map((tx) => {
              const isItemBroadcasting = broadcastingTxId === tx.id;
              const isQueued = tx.status === "queued";
              const isBroadcasted = tx.status === "broadcasted";
              const isFailed = tx.status === "failed";
              const isCancelled = tx.status === "cancelled";

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">
                          {tx.amount} {tx.asset}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700">
                          Nonce #{tx.nonce}
                        </span>
                        {/* Status Label */}
                        {isQueued && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            QUEUED
                          </span>
                        )}
                        {isItemBroadcasting && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            BROADCASTING
                          </span>
                        )}
                        {isBroadcasted && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            BROADCASTED
                          </span>
                        )}
                        {isFailed && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                            FAILED
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                            CANCELLED
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 text-xs text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div>
                          <span className="text-zinc-500">To: </span>
                          <span className="font-mono text-zinc-300">
                            {tx.recipient.slice(0, 8)}...{tx.recipient.slice(-6)}
                          </span>
                          {tx.recipientLabel && (
                            <span className="text-zinc-400 ml-1">({tx.recipientLabel})</span>
                          )}
                        </div>
                        <div className="text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(tx.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {isFailed && tx.error && (
                        <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="break-all">{tx.error}</span>
                        </div>
                      )}

                      {isBroadcasted && tx.broadcastHash && (
                        <div className="mt-2 text-xs text-emerald-400 flex items-center gap-2">
                          <Check className="w-3.5 h-3.5" />
                          <span className="font-mono text-[11px] text-zinc-300">
                            {tx.broadcastHash.slice(0, 10)}...{tx.broadcastHash.slice(-8)}
                          </span>
                          <a
                            href={`${robinhoodChain.blockExplorers.default.url}/tx/${tx.broadcastHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 underline text-[11px]"
                          >
                            Explorer
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isQueued && (
                        <button
                          onClick={() => onBroadcastTx(tx)}
                          disabled={!isNetworkReadyToBroadcast || isItemBroadcasting || isBroadcastingAll}
                          title={
                            isNetworkReadyToBroadcast
                              ? "Broadcast this transaction now"
                              : "Network offline or Force Air-Gap enabled"
                          }
                          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                            isNetworkReadyToBroadcast && !isItemBroadcasting
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                              : "bg-zinc-800 text-zinc-600 border-zinc-800 cursor-not-allowed"
                          }`}
                        >
                          {isItemBroadcasting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => onOpenAirGapQr(tx)}
                        title="View Air-Gap QR and raw hex payload"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleCopyRaw(tx)}
                        title="Copy serialized raw transaction hex"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                      >
                        {copiedTxId === tx.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => onRemoveTx(tx.id)}
                        title="Remove from outbox"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Target Network: Robinhood Chain (EIP-1559)</span>
          <span>Sequential Nonce Protection</span>
        </div>
      </div>
    </div>
  );
}
