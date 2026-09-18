import React from "react";
import { Radio, WifiOff } from "lucide-react";

interface Props {
  isForceAirGap: boolean;
  nextNonce: number;
}

export function OfflineQueueBanner({ isForceAirGap, nextNonce }: Props) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 shrink-0">
          {isForceAirGap ? <Radio className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center justify-between font-medium text-amber-300">
            <span>{isForceAirGap ? "Air-Gap Mode Active" : "Network Offline (Signing Mode)"}</span>
            <span className="font-mono text-[11px] text-amber-400 font-semibold">
              Outbox Nonce #{nextNonce}
            </span>
          </div>
          <p className="mt-1 text-zinc-300 text-[11px] leading-relaxed">
            Transaction will be cryptographically signed locally on this device using Shard A and staged in your Offline Outbox. You can broadcast when reconnected or export via Air-Gap QR.
          </p>
        </div>
      </div>
    </div>
  );
}
