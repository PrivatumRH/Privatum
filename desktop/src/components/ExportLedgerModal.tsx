import React, { useState, useMemo } from "react";
import { X, Download, FileSpreadsheet, FileCode, Check, ShieldCheck } from "lucide-react";
import type { Contact } from "../lib/contacts";
import {
  type ExportableTransaction,
  type LedgerDateFilter,
  type LedgerExportFormat,
  filterTransactionsByDate,
  filterTransactionsByTag,
  exportToCsv,
  exportToJson,
  getExportFilename,
  downloadLedgerFile,
} from "../lib/exportLedger";
import {
  type TransactionTag,
  TRANSACTION_TAGS,
  getTagConfig,
} from "../lib/transactionTags";
import { estimateUsdValue } from "../lib/spendGuardrails";

interface ExportLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: ExportableTransaction[];
  contacts: Contact[];
  walletAddress?: string;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export const ExportLedgerModal: React.FC<ExportLedgerModalProps> = ({
  isOpen,
  onClose,
  transactions,
  contacts,
  walletAddress = "",
  onNotify,
}) => {
  const [format, setFormat] = useState<LedgerExportFormat>("csv");
  const [dateFilter, setDateFilter] = useState<LedgerDateFilter>("all");
  const [tagFilter, setTagFilter] = useState<TransactionTag | "all">("all");
  const [isExported, setIsExported] = useState(false);

  const filteredTransactions = useMemo(() => {
    const byDate = filterTransactionsByDate(transactions, dateFilter);
    return filterTransactionsByTag(byDate, tagFilter);
  }, [transactions, dateFilter, tagFilter]);

  const totalUsdVolume = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => {
      return sum + estimateUsdValue(tx.amount, tx.asset);
    }, 0);
  }, [filteredTransactions]);

  if (!isOpen) return null;

  const handleDownload = () => {
    try {
      const mimeType =
        format === "csv" ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;";
      const content =
        format === "csv"
          ? exportToCsv(filteredTransactions, contacts, walletAddress)
          : exportToJson(filteredTransactions, contacts, walletAddress);

      const filename = getExportFilename(format);
      downloadLedgerFile(content, filename, mimeType);

      setIsExported(true);
      setTimeout(() => setIsExported(false), 2500);

      if (onNotify) {
        onNotify(
          "success",
          "Ledger Exported",
          `${filteredTransactions.length} transaction records saved to ${filename}`
        );
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify("error", "Export Failed", err?.message || "Failed to generate export file.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#f54842]" />
              <h3 className="text-base font-semibold text-white">Export Transaction History</h3>
            </div>
            <p className="text-xs text-slate-400">
              Download your local ledger for tax accounting and self-custody audit logs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Body */}
        <div className="py-5 space-y-5">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">File Format</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition ${
                  format === "csv"
                    ? "bg-[#f54842]/10 border-[#f54842] text-white"
                    : "bg-[#181a23] border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-[#f54842]" />
                <div className="text-left">
                  <div className="font-semibold text-white">CSV Spreadsheet</div>
                  <div className="text-[10px] text-slate-400">RFC-4180 (Excel, Sheets)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("json")}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition ${
                  format === "json"
                    ? "bg-[#f54842]/10 border-[#f54842] text-white"
                    : "bg-[#181a23] border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <FileCode className="w-4 h-4 text-[#f54842]" />
                <div className="text-left">
                  <div className="font-semibold text-white">JSON Bundle</div>
                  <div className="text-[10px] text-slate-400">Structured audit metadata</div>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Time Range</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "All Time" },
                { id: "30d", label: "Last 30 Days" },
                { id: "7d", label: "Last 7 Days" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateFilter(item.id as LedgerDateFilter)}
                  className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${
                    dateFilter === item.id
                      ? "bg-white/15 border-white/30 text-white"
                      : "bg-[#181a23] border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Center / Tag Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Cost Center / Tag</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTagFilter("all")}
                className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  tagFilter === "all"
                    ? "bg-white/15 border-white/30 text-white"
                    : "bg-[#181a23] border-white/5 text-slate-400 hover:text-slate-200"
                }`}
              >
                All Tags
              </button>
              {TRANSACTION_TAGS.map((t) => {
                const style = getTagConfig(t);
                const active = tagFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagFilter(t)}
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? `${style?.bgClass} ${style?.borderClass} ${style?.textClass}`
                        : "bg-[#181a23] border-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${style?.dotClass}`} />
                    <span>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Summary Box */}
          <div className="rounded-xl bg-[#161822] border border-white/[0.06] p-4 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span>Matching Records:</span>
              <span className="font-mono text-white font-semibold">
                {filteredTransactions.length} of {transactions.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Estimated Volume:</span>
              <span className="font-mono text-white font-semibold">
                ${totalUsdVolume.toFixed(2)} USD
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Target File:</span>
              <span className="font-mono text-[#f54842] text-[11px]">
                {getExportFilename(format)}
              </span>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              100% Client-Side. This file is generated entirely in browser memory. No transaction
              data is ever sent over the network.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 bg-[#f54842] hover:bg-[#e03e38] disabled:opacity-40 disabled:hover:bg-[#f54842] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition"
          >
            {isExported ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-white" />
                <span>Download {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
