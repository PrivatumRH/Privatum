import React from "react";
import { Check, Loader2, X, Circle, Cpu, Cloud, ShieldOff } from "lucide-react";
import {
  ceremonyFailed,
  coSignerLatencyMs,
  gradeLatency,
  quorumReached,
  signaturesCollected,
  totalElapsedMs,
  type CeremonyStage,
} from "../lib/thresholdCeremony";

interface ThresholdSignatureVisualProps {
  stages: CeremonyStage[];
}

const LATENCY_COLOR = {
  fast: "text-emerald-400",
  normal: "text-sky-400",
  slow: "text-amber-400",
} as const;

function StageIcon({ status }: { status: CeremonyStage["status"] }) {
  if (status === "done") return <Check className="w-3 h-3 text-emerald-400" />;
  if (status === "active") return <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />;
  if (status === "failed") return <X className="w-3 h-3 text-red-400" />;
  return <Circle className="w-3 h-3 text-white/15" />;
}

/** The three shares, drawn as what they are rather than as a decorative trio. */
function ShardPill({
  label,
  sub,
  icon,
  state,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  state: "idle" | "signing" | "signed" | "failed" | "absent";
}) {
  const styles = {
    idle: "border-white/10 bg-white/[0.03] text-white/40",
    signing: "border-sky-400/40 bg-sky-400/[0.08] text-sky-300",
    signed: "border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300",
    failed: "border-red-400/40 bg-red-400/[0.08] text-red-300",
    absent: "border-white/[0.06] bg-transparent text-white/20 border-dashed",
  }[state];

  return (
    <div className={`flex-1 min-w-0 rounded-xl border p-2.5 transition-colors ${styles}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] font-semibold truncate">{label}</span>
      </div>
      <div className="text-[9px] leading-tight opacity-70">{sub}</div>
    </div>
  );
}

export const ThresholdSignatureVisual: React.FC<ThresholdSignatureVisualProps> = ({ stages }) => {
  const shardA = stages.find((s) => s.id === "shard_a");
  const shardB = stages.find((s) => s.id === "shard_b");
  const collected = signaturesCollected(stages);
  const hasQuorum = quorumReached(stages);
  const failed = ceremonyFailed(stages);
  const latency = coSignerLatencyMs(stages);
  const elapsed = totalElapsedMs(stages);

  const shardState = (s?: CeremonyStage) =>
    s?.status === "done"
      ? "signed"
      : s?.status === "active"
        ? "signing"
        : s?.status === "failed"
          ? "failed"
          : "idle";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3.5">
      {/* Quorum header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-white/70">Threshold Quorum</div>
          <div className="text-[9px] text-white/35 mt-0.5">
            2-of-3 required to authorize this transaction
          </div>
        </div>
        <div
          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
            failed
              ? "border-red-400/40 bg-red-400/10 text-red-300"
              : hasQuorum
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-white/50"
          }`}
        >
          {collected} / 2
        </div>
      </div>

      {/* The three shares */}
      <div className="flex gap-2">
        <ShardPill
          label="Shard A"
          sub="Device, this machine"
          icon={<Cpu className="w-3 h-3 shrink-0" />}
          state={shardState(shardA)}
        />
        <ShardPill
          label="Shard B"
          sub="Co-signer, remote"
          icon={<Cloud className="w-3 h-3 shrink-0" />}
          state={shardState(shardB)}
        />
        {/* Shard C takes no part in a send. Drawing it as a participant would
            misrepresent the threshold, so it is shown explicitly standing by. */}
        <ShardPill
          label="Shard C"
          sub="Offline, recovery only"
          icon={<ShieldOff className="w-3 h-3 shrink-0" />}
          state="absent"
        />
      </div>

      {/* Measured stages */}
      <div className="space-y-1 pt-1">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-2 text-[10px]">
            <span className="w-3 shrink-0 flex items-center justify-center">
              <StageIcon status={stage.status} />
            </span>
            <span
              className={
                stage.status === "pending"
                  ? "text-white/25"
                  : stage.status === "failed"
                    ? "text-red-300"
                    : "text-white/65"
              }
            >
              {stage.label}
            </span>
            <span className="flex-1 border-b border-dashed border-white/[0.07] mx-1" />
            {stage.status === "done" && typeof stage.ms === "number" && (
              <span className="font-mono text-white/40 tabular-nums">{stage.ms} ms</span>
            )}
            {stage.status === "failed" && (
              <span className="font-mono text-red-400/80 truncate max-w-[140px]" title={stage.error}>
                failed
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Real measurements, not decoration */}
      {(latency !== null || elapsed > 0) && (
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.07] text-[9px]">
          <span className="text-white/35">
            {latency !== null ? (
              <>
                Co-signer round-trip{" "}
                <span className={`font-mono font-semibold ${LATENCY_COLOR[gradeLatency(latency)]}`}>
                  {latency} ms
                </span>
              </>
            ) : (
              "Awaiting co-signer"
            )}
          </span>
          {elapsed > 0 && (
            <span className="text-white/30 font-mono tabular-nums">{elapsed} ms total</span>
          )}
        </div>
      )}
    </div>
  );
};
