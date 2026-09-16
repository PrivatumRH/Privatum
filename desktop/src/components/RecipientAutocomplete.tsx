import React, { useState, useRef, useEffect, useMemo } from "react";
import { User, X, Clock, AlertTriangle, Search, BookUser, Star } from "lucide-react";
import { Contact } from "../lib/contacts";
import { AddressGuardHistoryEntry } from "../lib/addressGuard";
import {
  getAutocompleteCandidates,
  formatAddressTruncated,
  AutocompleteCandidate,
  TransactionSummaryLike,
} from "../lib/autocomplete";

export interface RecipientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectContact?: (candidate: AutocompleteCandidate) => void;
  contacts: Contact[];
  transactions?: TransactionSummaryLike[];
  ownAddress?: string;
  addressHistory?: AddressGuardHistoryEntry[];
  placeholder?: string;
  isStealthSend?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return "";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export const RecipientAutocomplete: React.FC<RecipientAutocompleteProps> = ({
  value,
  onChange,
  onSelectContact,
  contacts,
  transactions = [],
  ownAddress,
  addressHistory = [],
  placeholder = "0x... or contact name",
  isStealthSend = false,
  disabled = false,
  autoFocus = false,
  className = "",
  onPaste,
}) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute live candidates matching query (or top recent on empty focus)
  const candidates = useMemo(() => {
    return getAutocompleteCandidates({
      query: value,
      contacts,
      transactions,
      ownAddress,
      addressHistory,
      limit: 5,
    });
  }, [value, contacts, transactions, ownAddress, addressHistory]);

  const showDropdown = isFocused && candidates.length > 0;

  // Handle outside clicks to close the dropdown cleanly
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (candidate: AutocompleteCandidate) => {
    onChange(candidate.address);
    if (onSelectContact) {
      onSelectContact(candidate);
    }
    setIsFocused(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < candidates.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : candidates.length - 1
      );
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < candidates.length) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(candidates[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsFocused(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Tab" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(candidates[highlightedIndex]);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-500 pointer-events-none">
          {value.trim() ? (
            <Search className="w-3.5 h-3.5" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          onFocus={() => setIsFocused(true)}
          onPaste={onPaste}
          onChange={(e) => {
            onChange(e.target.value);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition-colors font-mono"
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setHighlightedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-0.5 text-slate-500 hover:text-white transition cursor-pointer"
            title="Clear recipient"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#181a23] border border-white/15 rounded-xl shadow-2xl overflow-hidden divide-y divide-white/5 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-400 bg-white/[0.02]">
            <span className="font-semibold uppercase tracking-wider">
              {value.trim() ? "Matching Contacts" : "Recent Counterparties"}
            </span>
            <span>{candidates.length} suggested</span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
            {candidates.map((candidate, idx) => {
              const isSelected = highlightedIndex === idx;

              return (
                <div
                  key={`${candidate.address}-${idx}`}
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers
                    e.preventDefault();
                    handleSelect(candidate);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-2.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-xs font-semibold ${
                        candidate.isSavedContact
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/[0.03] border-white/10 text-slate-400"
                      }`}
                    >
                      {candidate.isSavedContact ? (
                        candidate.name.charAt(0).toUpperCase()
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-white truncate">
                          {candidate.name}
                        </span>
                        {candidate.isStarred && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                        {candidate.category && (
                          <span className="text-[10px] text-slate-400">
                            ({candidate.category})
                          </span>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                        {formatAddressTruncated(candidate.address, 10, 8)}
                      </div>

                      {candidate.note && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {candidate.note}
                        </div>
                      )}

                      {candidate.isPoisonRisk && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400 mt-1 font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>
                            Look-alike risk: resembles {candidate.poisonTargetName || "past contact"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end justify-center">
                    {candidate.lastUsedAt && candidate.lastUsedAt > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {formatTimeAgo(candidate.lastUsedAt)}
                      </span>
                    )}
                    {candidate.transactionCount > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {candidate.transactionCount}{" "}
                        {candidate.transactionCount === 1 ? "tx" : "txs"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
