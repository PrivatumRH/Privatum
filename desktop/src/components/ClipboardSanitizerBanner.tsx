import React from "react";
import { ShieldAlert, AlertCircle, Info, RefreshCw, X } from "lucide-react";
import type { ClipboardSanitizerVerdict } from "../lib/clipboardSanitizer";

interface ClipboardSanitizerBannerProps {
  verdict: ClipboardSanitizerVerdict | null;
  onRestoreAddress?: (address: string) => void;
  onDismiss?: () => void;
  className?: string;
}

function RenderAddressSegments({
  address,
  prefixMatch,
  suffixMatch,
  isDivergent,
}: {
  address: string;
  prefixMatch: number;
  suffixMatch: number;
  isDivergent?: boolean;
}) {
  const clean = address.replace(/^0x/i, "");
  const head = clean.slice(0, prefixMatch);
  const tailLen = Math.max(0, Math.min(suffixMatch, clean.length - prefixMatch));
  const tail = tailLen > 0 ? clean.slice(clean.length - tailLen) : "";
  const middle = clean.slice(prefixMatch, clean.length - tailLen);

  return (
    <span className="font-mono text-[11px] break-all">
      <span className="text-slate-500">0x</span>
      <span className="text-slate-200 font-semibold">{head}</span>
      {middle && (
        <span
          className={`rounded-sm px-0.5 mx-0.5 ${
            isDivergent
              ? "bg-rose-500/30 text-rose-200 font-bold underline"
              : "bg-emerald-500/20 text-emerald-200"
          }`}
        >
          {middle}
        </span>
      )}
      <span className="text-slate-200 font-semibold">{tail}</span>
    </span>
  );
}

export const ClipboardSanitizerBanner: React.FC<ClipboardSanitizerBannerProps> = ({
  verdict,
  onRestoreAddress,
  onDismiss,
  className = "",
}) => {
  if (!verdict || verdict.severity === "clean") return null;

  const isDanger = verdict.severity === "danger";
  const isWarning = verdict.severity === "warning";
  const isInfo = verdict.severity === "info";

  return (
    <div
      className={`rounded-xl p-3 border text-xs transition-all animate-in fade-in duration-150 ${
        isDanger
          ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
          : isWarning
          ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
          : "bg-blue-950/30 border-blue-500/30 text-blue-200"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {isDanger ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : isWarning ? (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          )}

          <div className="space-y-1">
            <div
              className={`font-semibold ${
                isDanger
                  ? "text-rose-300"
                  : isWarning
                  ? "text-amber-300"
                  : "text-blue-300"
              }`}
            >
              {verdict.title}
            </div>
            <div
              className={`text-[11px] leading-relaxed ${
                isDanger
                  ? "text-rose-200/80"
                  : isWarning
                  ? "text-amber-200/80"
                  : "text-blue-200/80"
              }`}
            >
              {verdict.message}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-0.5 transition cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {verdict.divergence && (
        <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2">
          <div className="bg-black/40 rounded-lg p-2 space-y-1.5 font-sans">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                Intended Destination ({verdict.divergence.intendedLabel || "Copied in-app"})
              </div>
              <RenderAddressSegments
                address={verdict.divergence.intendedAddress}
                prefixMatch={verdict.divergence.prefixMatch}
                suffixMatch={verdict.divergence.suffixMatch}
                isDivergent={false}
              />
            </div>

            <div>
              <div className="text-[10px] text-rose-400 uppercase tracking-wider mb-0.5">
                Pasted Input (Middle Differs)
              </div>
              <RenderAddressSegments
                address={verdict.divergence.pastedAddress}
                prefixMatch={verdict.divergence.prefixMatch}
                suffixMatch={verdict.divergence.suffixMatch}
                isDivergent={true}
              />
            </div>
          </div>

          {onRestoreAddress && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => onRestoreAddress(verdict.divergence!.intendedAddress)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Restore Intended Address</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
