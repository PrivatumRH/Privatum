import React, { useState, useEffect } from "react";
import { AssistantDrawer } from "./AssistantDrawer";
import type { ParsedIntent } from "../../lib/assistant/types";
import type { Contact } from "../../lib/contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "../../lib/spendGuardrails";
import type { OfflineTransaction } from "../../lib/offlineOutbox";
import type { WhitelistEntry, WhitelistConfig } from "../../lib/transferWhitelist";
import type { BlacklistEntry } from "../../lib/transferBlacklist";

interface AssistantWidgetProps {
  walletAddress?: string;
  contacts: Contact[];
  guardrailConfig: SpendingGuardrailConfig;
  spendingHistory: SpendingRecord[];
  transactionHistory: { type: "send" | "receive"; counterparty: string; amount: string; asset: string }[];
  offlineOutbox?: OfflineTransaction[];
  isOnline?: boolean;
  forceAirGap?: boolean;
  confirmedNonce?: number;
  whitelistEntries?: WhitelistEntry[];
  whitelistConfig?: WhitelistConfig;
  blacklistEntries?: BlacklistEntry[];
  shardAPrivKey?: string;
  shardBAddress?: string;
  cosignerApiUrl?: string;
  recentCeremony?: import("../../lib/thresholdCeremony").CeremonyStage[];
  onApplyIntent: (intent: ParsedIntent) => void;
  /** Feature gate: inference_receipt_export (0.1.20). */
  receiptExportEnabled?: boolean;
  appVersion?: string;
  signDigest?: (digest: string) => Promise<string>;
  recoverSigner?: (digest: string, signature: string) => Promise<string>;
  onNotify?: (kind: "success" | "error" | "info", title: string, message: string) => void;
}

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({
  walletAddress,
  contacts,
  guardrailConfig,
  spendingHistory,
  transactionHistory,
  offlineOutbox,
  isOnline,
  forceAirGap,
  confirmedNonce,
  whitelistEntries,
  whitelistConfig,
  blacklistEntries,
  shardAPrivKey,
  shardBAddress,
  cosignerApiUrl,
  recentCeremony,
  onApplyIntent,
  receiptExportEnabled = false,
  appVersion,
  signDigest,
  recoverSigner,
  onNotify,
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
      {/* Floating Trigger Button: Positioned cleanly above the bottom status bar */}
      <div className="fixed bottom-12 right-6 z-30">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 bg-[#121212] hover:bg-[#1a1a1a] text-white border border-white/10 hover:border-[#B91C3B]/50 shadow-2xl rounded-full px-3.5 py-2 transition-all duration-200"
          title="Privatum Assistant (Ctrl+K)"
        >
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
        offlineOutbox={offlineOutbox}
        isOnline={isOnline}
        forceAirGap={forceAirGap}
        confirmedNonce={confirmedNonce}
        whitelistEntries={whitelistEntries}
        whitelistConfig={whitelistConfig}
        blacklistEntries={blacklistEntries}
        shardAPrivKey={shardAPrivKey}
        shardBAddress={shardBAddress}
        cosignerApiUrl={cosignerApiUrl}
        recentCeremony={recentCeremony}
        onApplyIntent={onApplyIntent}
        receiptExportEnabled={receiptExportEnabled}
        appVersion={appVersion}
        signDigest={signDigest}
        recoverSigner={recoverSigner}
        onNotify={onNotify}
      />
    </>
  );
};
