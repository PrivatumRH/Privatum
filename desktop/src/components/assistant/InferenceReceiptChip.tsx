import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Copy,
  Download,
  ShieldCheck,
  Loader2,
  X,
  CircleHelp,
  Minus,
} from "lucide-react";
import type { InferenceReceipt } from "../../lib/assistant/inferenceReceipt";
import {
  getDetCodeHash,
  getWasmCodeHash,
  getWasmModelHash,
} from "../../lib/assistant/inferenceReceipt";
import {
  buildReceiptBundle,
  receiptBundleFilename,
  verifyReceiptBundle,
  type ReceiptTranscript,
  type VerificationCheck,
  type VerificationReport,
} from "../../lib/assistant/receiptExport";

interface InferenceReceiptChipProps {
  receipt: InferenceReceipt;
  /** Plaintext the hashes commit to. Export/verify are unavailable without it. */
  transcript?: ReceiptTranscript;
  appVersion?: string;
  /** Address of the signer; omitted for an unsigned export. */
  walletAddress?: string;
  /** Signs the bundle digest with the device shard. Omit to export unsigned. */
  signDigest?: (digest: string) => Promise<string>;
  /** Recovers a signer address so the in-app verifier can check signatures. */
  recoverSigner?: (digest: string, signature: string) => Promise<string>;
  /** Feature gate: inference_receipt_export (0.1.20). */
  exportEnabled?: boolean;
  onNotify?: (kind: "success" | "error" | "info", title: string, message: string) => void;
}

const STATUS_STYLE: Record<
  VerificationCheck["status"],
  { icon: React.ReactNode; color: string; word: string }
> = {
  pass: {
    icon: <Check className="w-2.5 h-2.5" />,
    color: "text-emerald-400",
    word: "verified",
  },
  fail: {
    icon: <X className="w-2.5 h-2.5" />,
    color: "text-red-400",
    word: "failed",
  },
  unverifiable: {
    icon: <CircleHelp className="w-2.5 h-2.5" />,
    color: "text-amber-400",
    word: "not provable",
  },
  skipped: {
    icon: <Minus className="w-2.5 h-2.5" />,
    color: "text-white/35",
    word: "n/a",
  },
};

export const InferenceReceiptChip: React.FC<InferenceReceiptChipProps> = ({
  receipt,
  transcript,
  appVersion = "0.1.20",
  walletAddress,
  signDigest,
  recoverSigner,
  exportEnabled = false,
  onNotify,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);

  const canExport = exportEnabled && !!transcript;

  const handleCopyReceipt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** Hashes of the build running right now, for the provenance comparison. */
  const currentBuildHashes = async () => ({
    detCodeHash: await getDetCodeHash(),
    wasmCodeHash: await getWasmCodeHash(),
    wasmModelHash: await getWasmModelHash(),
  });

  const handleExport = async () => {
    if (!transcript) return;
    setExporting(true);
    try {
      const bundle = await buildReceiptBundle({
        receipt,
        transcript,
        appVersion,
        walletAddress,
        signDigest,
      });

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = receiptBundleFilename(receipt);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      onNotify?.(
        "success",
        bundle.signature ? "Signed Receipt Exported" : "Receipt Exported (Unsigned)",
        bundle.signature
          ? "The bundle includes your prompt and response in plaintext so anyone can re-derive the hashes."
          : "Exported without a wallet signature. Hashes are still checkable; the bundle is not bound to your wallet."
      );
    } catch (err: any) {
      console.error("Receipt export failed:", err);
      onNotify?.("error", "Export Failed", err?.message || "Could not build the receipt bundle.");
    } finally {
      setExporting(false);
    }
  };

  const handleVerify = async () => {
    if (!transcript) return;
    setVerifying(true);
    try {
      const bundle = await buildReceiptBundle({
        receipt,
        transcript,
        appVersion,
        walletAddress,
        signDigest,
      });
      const result = await verifyReceiptBundle(bundle, {
        expectedCodeHashes: await currentBuildHashes(),
        recoverSigner,
      });
      setReport(result);
    } catch (err: any) {
      console.error("Receipt verification failed:", err);
      onNotify?.("error", "Verification Failed", err?.message || "Could not verify this receipt.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors font-mono"
        title="View cryptographic inference receipt"
      >
        {expanded ? (
          <ChevronDown className="w-2.5 h-2.5 shrink-0" />
        ) : (
          <ChevronRight className="w-2.5 h-2.5 shrink-0" />
        )}
        <span>receipt</span>
        <span className="text-white/15">:</span>
        <span className="text-white/50">{receipt.shortRef}</span>
        <span className="text-white/15">|</span>
        <span className="text-white/30">{receipt.engine}</span>
      </button>

      {expanded && (
        <div className="mt-1.5 rounded-lg bg-black/50 border border-white/5 p-2.5 space-y-1.5 text-[10px] font-mono">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <span className="text-white/40 font-sans font-medium text-[10px]">
              Cryptographic Receipt
            </span>
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          {[
            ["code", receipt.codeHash],
            ["model", receipt.modelHash],
            ["input", receipt.inputHash],
            ["output", receipt.outputHash],
          ].map(([label, hash]) => (
            <div key={label} className="flex gap-2">
              <span className="text-white/25 w-12 shrink-0">{label}:</span>
              <span className="text-white/50 break-all">{hash}</span>
            </div>
          ))}

          <div className="flex gap-2">
            <span className="text-white/25 w-12 shrink-0">engine:</span>
            <span className="text-white/50">{receipt.engine}</span>
          </div>

          <div className="flex gap-2">
            <span className="text-white/25 w-12 shrink-0">timestamp:</span>
            <span className="text-white/50">{new Date(receipt.ts).toISOString()}</span>
          </div>

          {canExport && (
            <>
              <div className="grid grid-cols-2 gap-1.5 pt-2 mt-1 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-[9px] font-sans font-medium transition disabled:opacity-50"
                >
                  {verifying ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-2.5 h-2.5" />
                  )}
                  <span>{verifying ? "Checking..." : "Verify"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-[9px] font-sans font-medium transition disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Download className="w-2.5 h-2.5" />
                  )}
                  <span>{exporting ? "Building..." : signDigest ? "Export Signed" : "Export"}</span>
                </button>
              </div>

              {report && (
                <div className="mt-1.5 pt-2 border-t border-white/5 space-y-1">
                  <div className="flex items-center justify-between pb-0.5">
                    <span className="font-sans font-medium text-[10px] text-white/40">
                      Offline Verification
                    </span>
                    <span
                      className={`text-[9px] font-sans font-semibold ${
                        report.valid ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {report.valid ? "No check failed" : "Check failed"}
                    </span>
                  </div>

                  {report.checks.map((c) => {
                    const style = STATUS_STYLE[c.status];
                    return (
                      <div key={c.id} className="flex items-start gap-1.5" title={c.detail}>
                        <span className={`${style.color} mt-[3px] shrink-0`}>{style.icon}</span>
                        <span className="text-white/45 font-sans shrink-0">{c.label}</span>
                        <span className="text-white/15">-</span>
                        <span className={`${style.color} font-sans`}>{style.word}</span>
                      </div>
                    );
                  })}

                  {report.unverifiableCount > 0 && (
                    <p className="text-white/35 font-sans leading-relaxed pt-1 text-[9px]">
                      Hash integrity is proven here. Code and model identity are self-asserted by
                      this build and cannot be proven offline - attested hardware is what would
                      close that gap.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {exportEnabled && !transcript && (
            <p className="text-white/30 font-sans leading-relaxed pt-2 mt-1 border-t border-white/5 text-[9px]">
              This receipt predates transcript retention, so it cannot be exported for offline
              verification.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
