import React, { useState, useMemo } from "react";
import { Search, X, Plus, AlertCircle, Check } from "lucide-react";
import { isAddress, type Address } from "viem";
import type { TokenInfo } from "../lib/tokens";

interface TokenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: TokenInfo) => void;
  selectedToken?: TokenInfo;
  tokens: TokenInfo[];
  onAddCustomToken: (token: TokenInfo) => void;
}

export function TokenPickerModal({
  isOpen,
  onClose,
  onSelectToken,
  selectedToken,
  tokens,
  onAddCustomToken,
}: TokenPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Custom token form state
  const [customAddress, setCustomAddress] = useState("");
  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDecimals, setCustomDecimals] = useState("18");
  const [customError, setCustomError] = useState<string | null>(null);

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
    );
  }, [tokens, searchQuery]);

  if (!isOpen) return null;

  function handleImportCustom(e: React.FormEvent) {
    e.preventDefault();
    setCustomError(null);

    const addr = customAddress.trim();
    if (!isAddress(addr)) {
      setCustomError("Please enter a valid 0x-prefixed contract address.");
      return;
    }

    const sym = customSymbol.trim().toUpperCase();
    if (!sym) {
      setCustomError("Please specify a token symbol (e.g. TKN).");
      return;
    }

    const dec = parseInt(customDecimals, 10);
    if (isNaN(dec) || dec < 0 || dec > 36) {
      setCustomError("Decimals must be an integer between 0 and 36.");
      return;
    }

    const newToken: TokenInfo = {
      symbol: sym,
      name: customName.trim() || sym,
      address: addr as Address,
      decimals: dec,
      color: "#8b5cf6",
    };

    onAddCustomToken(newToken);
    onSelectToken(newToken);
    onClose();

    // Reset form
    setCustomAddress("");
    setCustomSymbol("");
    setCustomName("");
    setCustomDecimals("18");
    setShowAddCustom(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#181a22] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white text-base">Select a Token</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, symbol, or address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#13151b] border border-white/[0.08] text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition"
          />
        </div>

        {/* Add custom toggle */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400 font-medium">Default Assets</span>
          <button
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="flex items-center gap-1 text-slate-300 hover:text-white font-medium transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddCustom ? "Cancel" : "Add Custom Token"}</span>
          </button>
        </div>

        {/* Custom token form */}
        {showAddCustom && (
          <form
            onSubmit={handleImportCustom}
            className="p-3.5 rounded-xl bg-[#13151b] border border-white/[0.08] flex flex-col gap-2.5 text-xs"
          >
            <span className="font-semibold text-white">Import Unlisted Token</span>

            {customError && (
              <div className="flex items-center gap-1.5 text-red-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{customError}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400">
                Contract Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#181a22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400">
                  Symbol
                </label>
                <input
                  type="text"
                  placeholder="e.g. TKN"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#181a22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400">
                  Decimals
                </label>
                <input
                  type="number"
                  placeholder="18"
                  value={customDecimals}
                  onChange={(e) => setCustomDecimals(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#181a22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-white/20"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-400">
                Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. My Custom Token"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-[#181a22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-white/20"
              />
            </div>

            <button
              type="submit"
              className="mt-1 w-full py-2 px-3 rounded-lg bg-[#f64943] hover:bg-[#e03d38] text-white font-semibold text-xs transition cursor-pointer"
            >
              Add Token
            </button>
          </form>
        )}

        {/* Token List */}
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1 pr-1">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No matching tokens found.
            </div>
          ) : (
            filteredTokens.map((t) => {
              const isSelected = selectedToken?.address.toLowerCase() === t.address.toLowerCase();
              return (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => {
                    onSelectToken(t);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer ${
                    isSelected
                      ? "bg-white/10 text-white"
                      : "hover:bg-white/5 text-neutral-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {t.icon ? (
                      <img
                        src={t.icon}
                        alt={t.symbol}
                        className="w-8 h-8 rounded-full object-cover shrink-0 bg-neutral-900 border border-white/10"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
                        style={{ backgroundColor: t.color || "#3b82f6" }}
                      >
                        {t.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex flex-col text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white text-xs">{t.symbol}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 truncate">{t.name}</span>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
