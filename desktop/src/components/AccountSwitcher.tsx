import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check, Copy } from "lucide-react";
import type { Address } from "viem";

export interface WalletAccount {
  id: string;
  name: string;
  address: Address;
  color: string;
  createdAt: number;
}

interface AccountSwitcherProps {
  accounts: WalletAccount[];
  activeAccountId: string;
  onSelectAccount: (account: WalletAccount) => void;
  onCreateAccount: () => void;
  onCopyAddress: (address: string) => void;
}

export function getAccountDisplayName(acc: WalletAccount, index: number): string {
  if (!acc.name || acc.name === "Primary Treasury" || acc.name.startsWith("Account ")) {
    return `Wallet ${index + 1}`;
  }
  return acc.name;
}

export function AccountSwitcher({
  accounts,
  activeAccountId,
  onSelectAccount,
  onCreateAccount,
  onCopyAddress,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeIndex = accounts.findIndex((a) => a.id === activeAccountId);
  const activeAccount = accounts[activeIndex >= 0 ? activeIndex : 0];
  const activeName = activeAccount
    ? getAccountDisplayName(activeAccount, activeIndex >= 0 ? activeIndex : 0)
    : "Wallet 1";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function shorten(addr: string) {
    if (!addr || addr.length < 10) return addr || "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 flex items-center gap-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left text-xs text-white cursor-pointer"
        title="Switch active account"
      >
        {/* Solid color circle with no text */}
        <div
          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: activeAccount?.color || "#ef4444" }}
        />
        <span className="font-semibold leading-none">{activeName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform ml-0.5 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 sm:left-0 mt-2 w-56 rounded-2xl bg-[#181a22] backdrop-blur-xl border border-white/[0.08] p-2 shadow-2xl z-50 flex flex-col gap-1 text-xs">
          <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1">
            {accounts.map((acc, index) => {
              const isSelected = acc.id === activeAccount?.id;
              const displayName = getAccountDisplayName(acc, index);
              return (
                <div
                  key={acc.id}
                  onClick={() => {
                    onSelectAccount(acc);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-white/10 text-white font-medium"
                      : "text-neutral-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Solid color circle with no text */}
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: acc.color }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate leading-tight">{displayName}</span>
                      <span className="text-[10px] text-neutral-400 font-mono leading-tight">
                        {shorten(acc.address)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyAddress(acc.address);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
                      title="Copy Address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-white/10 my-1" />

          <button
            onClick={() => {
              setIsOpen(false);
              onCreateAccount();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white transition-all font-medium text-xs border border-white/5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>
      )}
    </div>
  );
}
