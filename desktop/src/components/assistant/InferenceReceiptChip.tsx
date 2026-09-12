import React, { useState } from "react";
import { ChevronRight, ChevronDown, Check, Copy } from "lucide-react";
import type { InferenceReceipt } from "../../lib/assistant/inferenceReceipt";

interface InferenceReceiptChipProps {
  receipt: InferenceReceipt;
}

export const InferenceReceiptChip: React.FC<InferenceReceiptChipProps> = ({ receipt }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyReceipt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        </div>
      )}
    </div>
  );
};
