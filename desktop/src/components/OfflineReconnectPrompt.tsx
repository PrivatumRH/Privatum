import React from "react";
import { Loader2, Radio, Send, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  queuedCount: number;
  onBroadcastAll: () => void;
  onReviewOutbox: () => void;
  onDismiss: () => void;
  isBroadcasting?: boolean;
}

export function OfflineReconnectPrompt({
  isOpen,
  queuedCount,
  onBroadcastAll,
  onReviewOutbox,
  onDismiss,
  isBroadcasting,
}: Props) {
  if (!isOpen || queuedCount <= 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl bg-zinc-950 border border-amber-500/30 p-4 shadow-2xl text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">
                Network Connection Restored
              </h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                You have <span className="font-semibold text-amber-400 font-mono">{queuedCount}</span> queued offline transfer{queuedCount === 1 ? "" : "s"} ready for onchain settlement.
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onReviewOutbox}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors"
          >
            Review Outbox
          </button>
          <button
            onClick={onBroadcastAll}
            disabled={isBroadcasting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-zinc-950 border border-amber-400 transition-colors disabled:opacity-50"
          >
            {isBroadcasting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Broadcasting...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Broadcast All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
