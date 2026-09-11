import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check, Shield, KeyRound, Wallet, Copy } from "lucide-react";
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

export function AccountSwitcher({
  accounts,
  activeAccountId,
  onSelectAccount,
  onCreateAccount,
  onCopyAddress,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];

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
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left text-xs text-white"
        title="Switch active self-custody account"
      >
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: activeAccount?.color || "#ef4444" }}
        >
          {activeAccount?.name?.charAt(0) || "W"}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold leading-tight">{activeAccount?.name || "Primary Wallet"}</span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {shorten(activeAccount?.address || "")}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl z-50 flex flex-col gap-1 text-xs">
          <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center justify-between">
            <span>OS Keychain Accounts</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="w-2.5 h-2.5" /> Protected
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1">
            {accounts.map((acc) => {
              const isSelected = acc.id === activeAccount?.id;
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
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: acc.color }}
                    >
                      {acc.name.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{acc.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">
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
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white"
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
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white transition-all font-medium text-xs border border-white/5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Smart Account</span>
          </button>
        </div>
      )}
    </div>
  );
}
