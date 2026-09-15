import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  ShieldAlert,
  Ban,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  getAllBlacklistEntries,
  loadCustomBlacklist,
  addCustomBlacklistEntry,
  removeCustomBlacklistEntry,
  exportBlacklistJson,
  importBlacklistJson,
  isValidAddress,
  normalizeAddress,
  type BlacklistEntry,
  type BlacklistCategory,
} from "../lib/transferBlacklist";

interface BlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
  onBlacklistUpdated?: () => void;
}

const CATEGORIES: BlacklistCategory[] = [
  "Phishing",
  "Malicious",
  "Sanctioned",
  "Compromised",
  "Custom",
];

export const BlacklistModal: React.FC<BlacklistModalProps> = ({
  isOpen,
  onClose,
  initialAddress,
  onNotify,
  onBlacklistUpdated,
}) => {
  const [entries, setEntries] = useState<BlacklistEntry[]>(() => getAllBlacklistEntries());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");

  // Add form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newCategory, setNewCategory] = useState<BlacklistCategory>("Malicious");
  const [formError, setFormError] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload entries on open
  useEffect(() => {
    if (isOpen) {
      setEntries(getAllBlacklistEntries());
      setSearchQuery("");
      setFormError("");
      if (initialAddress) {
        setIsAddOpen(true);
        setNewAddress(initialAddress);
        setNewReason("Identified from transaction history");
      }
    }
  }, [isOpen, initialAddress]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    const fresh = getAllBlacklistEntries();
    setEntries(fresh);
    if (onBlacklistUpdated) onBlacklistUpdated();
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newAddress.trim()) {
      setFormError("Address is required.");
      return;
    }

    if (!isValidAddress(newAddress.trim())) {
      setFormError("Invalid 0x Ethereum address format (40 hexadecimal characters required).");
      return;
    }

    if (!newReason.trim()) {
      setFormError("Please specify a reason for blacklisting.");
      return;
    }

    const result = addCustomBlacklistEntry({
      address: newAddress.trim(),
      name: newName.trim() || undefined,
      reason: newReason.trim(),
      category: newCategory,
    });

    if (!result.success) {
      setFormError(result.error || "Failed to add address to blacklist.");
      return;
    }

    handleRefresh();
    setNewAddress("");
    setNewName("");
    setNewReason("");
    setIsAddOpen(false);

    if (onNotify) {
      onNotify("success", "Address Blacklisted", "Counterparty added to custom blocklist.");
    }
  };

  const handleRemoveEntry = (address: string) => {
    removeCustomBlacklistEntry(address);
    handleRefresh();
    if (onNotify) {
      onNotify("info", "Blacklist Updated", "Address removed from custom blocklist.");
    }
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  const handleExport = () => {
    try {
      const jsonStr = exportBlacklistJson();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `privatum-transfer-blacklist-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (onNotify) {
        onNotify("success", "Export Complete", "Custom blacklist downloaded.");
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify("error", "Export Failed", err?.message || "Could not export blacklist.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importBlacklistJson(content);
        if (result.success) {
          handleRefresh();
          if (onNotify) {
            onNotify(
              "success",
              "Import Successful",
              `Added or updated ${result.addedCount} custom blacklist entries.`
            );
          }
        } else {
          if (onNotify) {
            onNotify("error", "Import Failed", result.error || "Failed to parse JSON file.");
          }
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      // Source filter
      if (selectedSource !== "all" && item.source !== selectedSource) return false;

      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

      // Search query
      if (query) {
        const addrMatch = item.address.toLowerCase().includes(query);
        const nameMatch = (item.name || "").toLowerCase().includes(query);
        const reasonMatch = item.reason.toLowerCase().includes(query);
        const catMatch = item.category.toLowerCase().includes(query);
        return addrMatch || nameMatch || reasonMatch || catMatch;
      }

      return true;
    });
  }, [entries, searchQuery, selectedCategory, selectedSource]);

  const customCount = entries.filter((e) => e.source === "user").length;
  const curatedCount = entries.filter((e) => e.source === "curated").length;

  const getCategoryBadgeClass = (category: BlacklistCategory) => {
    switch (category) {
      case "Phishing":
        return "bg-rose-500/10 text-rose-300 border-rose-500/20";
      case "Malicious":
        return "bg-red-500/10 text-red-300 border-red-500/20";
      case "Sanctioned":
        return "bg-amber-500/10 text-amber-300 border-amber-500/20";
      case "Compromised":
        return "bg-purple-500/10 text-purple-300 border-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-300 border-slate-500/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        style={{ backgroundColor: "#12141a" }}
        className="border border-white/10 rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh] text-white shadow-2xl relative overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.08] flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
                <Ban className="w-4 h-4 text-rose-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Transfer Blacklist Guard</h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-slate-400">
                v0.1.33
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic counterparty blocklist. Outgoing transactions to these addresses are strictly hard-blocked.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-grow">
          {/* Summary Metrics & Controls Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#181a24] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] font-mono text-slate-400">Total Blocked</div>
              <div className="text-lg font-bold text-white mt-0.5">{entries.length}</div>
            </div>
            <div className="bg-[#181a24] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] font-mono text-slate-400">Curated Threat Feed</div>
              <div className="text-lg font-bold text-cyan-400 mt-0.5">{curatedCount}</div>
            </div>
            <div className="bg-[#181a24] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[11px] font-mono text-slate-400">Custom Workstation</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{customCount}</div>
            </div>
          </div>

          {/* Action Row: Add Form Trigger + Search + Source Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search addresses, names, reasons..."
                className="w-full bg-[#181a24] border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(!isAddOpen)}
                className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Address</span>
              </button>
            </div>
          </div>

          {/* Category & Source Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-white/15 text-white"
                  : "bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-white/15 text-white"
                    : "bg-white/[0.03] text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
            <span className="text-slate-600 px-1">|</span>
            <button
              onClick={() => setSelectedSource("all")}
              className={`px-2 py-1 rounded-lg transition font-medium cursor-pointer ${
                selectedSource === "all"
                  ? "bg-white/15 text-white"
                  : "bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSelectedSource("curated")}
              className={`px-2 py-1 rounded-lg transition font-medium cursor-pointer ${
                selectedSource === "curated"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              Curated Only
            </button>
            <button
              onClick={() => setSelectedSource("user")}
              className={`px-2 py-1 rounded-lg transition font-medium cursor-pointer ${
                selectedSource === "user"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              Custom Only
            </button>
          </div>

          {/* Expandable Add Blacklist Address Form */}
          {isAddOpen && (
            <form
              onSubmit={handleAddEntry}
              className="bg-[#181a24] border border-rose-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block New Counterparty</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-300">
                    Recipient Address (0x format) *
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full mt-1 bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300">
                      Label / Counterparty Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Suspected Drainer Bot"
                      className="w-full mt-1 bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as BlacklistCategory)}
                      className="w-full mt-1 bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/60"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300">Reason for Block *</label>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Malicious Telegram phishing link"
                    className="w-full mt-1 bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60"
                  />
                </div>

                {formError && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-semibold text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm & Block Address</span>
                </button>
              </div>
            </form>
          )}

          {/* Entries Table / List */}
          <div className="space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="bg-[#181a24] border border-white/5 rounded-xl p-8 text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-xs font-medium text-slate-300">No matching blacklist entries</div>
                <div className="text-[11px] text-slate-500">
                  Try adjusting your search criteria or add a custom blocked address.
                </div>
              </div>
            ) : (
              filteredEntries.map((item) => {
                const isCurated = item.source === "curated";
                const isCopied = copiedAddress === item.address;

                return (
                  <div
                    key={item.address}
                    className="bg-[#181a24] border border-white/[0.06] hover:border-white/15 rounded-xl p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.name && (
                          <span className="text-xs font-semibold text-white">{item.name}</span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${getCategoryBadgeClass(
                            item.category
                          )}`}
                        >
                          {item.category}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                            isCurated
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          }`}
                        >
                          {isCurated ? "Curated Feed" : "Custom Block"}
                        </span>
                      </div>

                      {/* Address row with copy button */}
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                        <span className="truncate">{item.address}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.address)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                          title="Copy Address"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Reason Description */}
                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {item.reason}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!isCurated ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(item.address)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs transition flex items-center gap-1 cursor-pointer border border-white/[0.06]"
                          title="Remove from custom blacklist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      ) : (
                        <span
                          className="text-[10px] font-mono text-slate-500 px-2 py-1 rounded bg-white/[0.02]"
                          title="Curated threats are protected and cannot be removed"
                        >
                          Protected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-white/[0.08] bg-[#0c0d12] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer border border-white/[0.06]"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={customCount === 0}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer border border-white/[0.06] disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export Custom ({customCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
