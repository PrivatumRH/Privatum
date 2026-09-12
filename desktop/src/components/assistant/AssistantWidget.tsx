import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AssistantDrawer } from "./AssistantDrawer";
import type { ParsedIntent } from "../../lib/assistant/types";
import type { Contact } from "../../lib/contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "../../lib/spendGuardrails";

interface AssistantWidgetProps {
  walletAddress?: string;
  contacts: Contact[];
  guardrailConfig: SpendingGuardrailConfig;
  spendingHistory: SpendingRecord[];
  transactionHistory: { type: "send" | "receive"; counterparty: string; amount: string; asset: string }[];
  onApplyIntent: (intent: ParsedIntent) => void;
}

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({
  walletAddress,
  contacts,
  guardrailConfig,
  spendingHistory,
  transactionHistory,
  onApplyIntent,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Global hotkey: Ctrl+K or Cmd+K toggles the assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 bg-[#121212] hover:bg-[#1a1a1a] text-white border border-white/10 hover:border-[#f54842]/50 shadow-2xl rounded-full px-4 py-3 transition-all duration-200"
          title="Privatum Assistant (Ctrl+K)"
        >
          <div className="w-6 h-6 rounded-full bg-[#f54842]/10 border border-[#f54842]/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Sparkles className="w-3.5 h-3.5 text-[#f54842]" />
          </div>
          <span className="text-xs font-medium">Assistant</span>
          <kbd className="hidden sm:inline-block text-[10px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Slide-out Drawer */}
      <AssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        walletAddress={walletAddress}
        contacts={contacts}
        guardrailConfig={guardrailConfig}
        spendingHistory={spendingHistory}
        transactionHistory={transactionHistory}
        onApplyIntent={onApplyIntent}
      />
    </>
  );
};
