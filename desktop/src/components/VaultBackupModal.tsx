import React, { useState, useRef } from "react";
import {
  X,
  Lock,
  Download,
  Upload,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Database,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  encryptVault,
  decryptVault,
  gatherVaultState,
  summarizeVault,
  applyRestoredVault,
  downloadVaultFile,
  type VaultStatePayload,
  type VaultSummary,
} from "../lib/vaultBackup";

interface VaultBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

type ModalTab = "export" | "restore";

export const VaultBackupModal: React.FC<VaultBackupModalProps> = ({
  isOpen,
  onClose,
  onRestored,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>("export");

  // Export State
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedPayload, setDecryptedPayload] = useState<VaultStatePayload | null>(null);
  const [vaultSummary, setVaultSummary] = useState<VaultSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "overwrite">("merge");
  const [isApplying, setIsApplying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Compute live current state summary for Export tab
  const currentState = gatherVaultState("0.1.31");
  const currentSummary = summarizeVault(currentState);

  const handleExport = async () => {
    if (!exportPassphrase || exportPassphrase.length < 8) {
      if (onNotify) onNotify("error", "Invalid Passphrase", "Passphrase must be at least 8 characters long.");
      return;
    }

    if (exportPassphrase !== exportConfirm) {
      if (onNotify) onNotify("error", "Passphrase Mismatch", "The two passphrases entered do not match.");
      return;
    }

    setIsExporting(true);
    try {
      const statePayload = gatherVaultState("0.1.31");
      const serialized = JSON.stringify(statePayload);
      const containerBytes = await encryptVault(exportPassphrase, serialized);

      downloadVaultFile(containerBytes);

      if (onNotify) {
        onNotify(
          "success",
          "Vault Backup Created",
          `Encrypted ${statePayload.accounts.length} account(s) and full state into .privvault archive.`
        );
      }

      setExportPassphrase("");
      setExportConfirm("");
      onClose();
    } catch (err: any) {
      if (onNotify) {
        onNotify("error", "Backup Failed", err?.message || "Failed to encrypt and export vault.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDecryptedPayload(null);
      setVaultSummary(null);
    }
  };

  const handleDecryptFile = async () => {
    if (!selectedFile) {
      if (onNotify) onNotify("error", "Missing File", "Please select a .privvault file to restore.");
      return;
    }
    if (!restorePassphrase) {
      if (onNotify) onNotify("error", "Missing Passphrase", "Please enter the passphrase for this vault file.");
      return;
    }

    setIsDecrypting(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const jsonStr = await decryptVault(restorePassphrase, buffer);
      const payload: VaultStatePayload = JSON.parse(jsonStr);

      if (payload.format !== "privatum-encrypted-vault") {
        throw new Error("Unrecognized vault structure format.");
      }

      const summary = summarizeVault(payload);
      setDecryptedPayload(payload);
      setVaultSummary(summary);

      if (onNotify) {
        onNotify("info", "Archive Decrypted", "Passphrase verified. Review archive contents before applying.");
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify("error", "Decryption Failed", err?.message || "Incorrect passphrase or invalid file.");
      }
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleApplyRestore = () => {
    if (!decryptedPayload) return;

    setIsApplying(true);
    try {
      const res = applyRestoredVault(decryptedPayload, restoreMode);

      if (onNotify) {
        onNotify(
          "success",
          "Vault Restored Successfully",
          `Restored ${res.accountsRestored} account(s), ${res.contactsRestored} contact(s), and ${res.transactionsRestored} transaction(s).`
        );
      }

      if (onRestored) {
        onRestored();
      }

      onClose();
    } catch (err: any) {
      if (onNotify) {
        onNotify("error", "Restore Error", err?.message || "Failed to restore state to local storage.");
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl max-w-lg w-full flex flex-col max-h-[90vh] text-white shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.08] flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#f54842]" />
              <h3 className="text-base font-semibold text-white">Full-State Encrypted Vault</h3>
            </div>
            <p className="text-xs text-slate-400">
              One-click encrypted backup and restore for keychain, contacts, and transactions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] bg-[#0c0d12] px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "export"
                ? "border-[#f54842] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Vault Archive
          </button>
          <button
            onClick={() => setActiveTab("restore")}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "restore"
                ? "border-[#f54842] text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Restore from Archive
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-grow">
          {activeTab === "export" ? (
            <>
              {/* Current State Summary Card */}
              <div className="bg-[#181a24] border border-white/[0.08] rounded-xl p-4 space-y-3">
                <div className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                  State to Archive
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#12141a] p-2.5 rounded-lg border border-white/[0.04]">
                    <div className="text-lg font-bold text-white font-mono">
                      {currentSummary.accountCount}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3 text-slate-500" />
                      Accounts
                    </div>
                  </div>
                  <div className="bg-[#12141a] p-2.5 rounded-lg border border-white/[0.04]">
                    <div className="text-lg font-bold text-white font-mono">
                      {currentSummary.totalContacts}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-slate-500" />
                      Contacts
                    </div>
                  </div>
                  <div className="bg-[#12141a] p-2.5 rounded-lg border border-white/[0.04]">
                    <div className="text-lg font-bold text-white font-mono">
                      {currentSummary.totalTransactions}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Records
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Archives MPC Shard A keys, address book labels, spending limits, and tagged
                  transaction records into a single authenticated file.
                </div>
              </div>

              {/* Security Specs */}
              <div className="flex items-start gap-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium text-white">Client-Side Authenticated Encryption</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    AES-GCM-256 with 100,000 PBKDF2 iterations and SHA-256 key derivation. Zero
                    network requests or telemetry are sent.
                  </div>
                </div>
              </div>

              {/* Passphrase Fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Vault Encryption Passphrase</span>
                    <span className="text-[10px] text-slate-500 font-mono">Min 8 characters</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showExportPassword ? "text" : "password"}
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      placeholder="Enter a strong passphrase"
                      className="w-full bg-[#181a24] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50 font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExportPassword(!showExportPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Confirm Vault Passphrase
                  </label>
                  <input
                    type={showExportPassword ? "text" : "password"}
                    value={exportConfirm}
                    onChange={(e) => setExportConfirm(e.target.value)}
                    placeholder="Repeat passphrase"
                    className="w-full bg-[#181a24] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50 font-mono"
                  />
                  {exportPassphrase && exportConfirm && exportPassphrase !== exportConfirm && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Passphrases do not match
                    </p>
                  )}
                </div>
              </div>

              {/* Critical Warning */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  Keep this passphrase safe. Due to authenticated AES-GCM encryption, if you lose your
                  passphrase, there is no backdoor or recovery mechanism.
                </div>
              </div>
            </>
          ) : (
            <>
              {/* File Select */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Select Vault Archive</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-white/20 bg-[#181a24] rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".privvault"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
                      <FileCheck className="w-4 h-4" />
                      <span>{selectedFile.name}</span>
                      <span className="text-slate-500">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <div className="text-xs font-medium text-slate-200">
                        Click to select .privvault file
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Select a previously exported Privatum vault container
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Passphrase Input for Restore */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Vault Decryption Passphrase</label>
                <div className="relative">
                  <input
                    type={showRestorePassword ? "text" : "password"}
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Enter vault passphrase"
                    className="w-full bg-[#181a24] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestorePassword(!showRestorePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showRestorePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Decrypt and Inspect Action */}
              {!vaultSummary && (
                <button
                  type="button"
                  onClick={handleDecryptFile}
                  disabled={!selectedFile || !restorePassphrase || isDecrypting}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isDecrypting ? (
                    <span>Verifying and Decrypting...</span>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Decrypt & Inspect Archive</span>
                    </>
                  )}
                </button>
              )}

              {/* Inspected Archive Summary */}
              {vaultSummary && (
                <div className="bg-[#181a24] border border-emerald-500/30 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verified Archive</span>
                    </div>
                    {vaultSummary.createdAt && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(vaultSummary.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#12141a] p-2 rounded-lg border border-white/[0.04]">
                      <div className="text-base font-bold text-white font-mono">
                        {vaultSummary.accountCount}
                      </div>
                      <div className="text-[10px] text-slate-400">Accounts</div>
                    </div>
                    <div className="bg-[#12141a] p-2 rounded-lg border border-white/[0.04]">
                      <div className="text-base font-bold text-white font-mono">
                        {vaultSummary.totalContacts}
                      </div>
                      <div className="text-[10px] text-slate-400">Contacts</div>
                    </div>
                    <div className="bg-[#12141a] p-2 rounded-lg border border-white/[0.04]">
                      <div className="text-base font-bold text-white font-mono">
                        {vaultSummary.totalTransactions}
                      </div>
                      <div className="text-[10px] text-slate-400">Transactions</div>
                    </div>
                  </div>

                  {/* Account preview list */}
                  <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar pt-1">
                    {vaultSummary.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#12141a]/60 border border-white/[0.04]"
                      >
                        <span className="font-medium text-slate-200">{acc.name}</span>
                        <span className="font-mono text-slate-500 text-[10px]">
                          {acc.address ? `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}` : "No address"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mode selector: Merge vs Overwrite */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                    <label className="text-xs font-medium text-slate-300">Restore Strategy</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRestoreMode("merge")}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          restoreMode === "merge"
                            ? "bg-white/[0.08] border-[#f54842] text-white"
                            : "bg-[#12141a] border-white/5 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>Merge State</span>
                          {restoreMode === "merge" && <Check className="w-3 h-3 text-[#f54842]" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Preserves current items; appends missing accounts and contacts.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode("overwrite")}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          restoreMode === "overwrite"
                            ? "bg-white/[0.08] border-[#f54842] text-white"
                            : "bg-[#12141a] border-white/5 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>Overwrite State</span>
                          {restoreMode === "overwrite" && (
                            <Check className="w-3 h-3 text-[#f54842]" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Replaces all accounts, guardrails, and records with archive data.
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 pt-4 border-t border-white/[0.08] bg-[#0c0d12] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          {activeTab === "export" ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={
                !exportPassphrase ||
                exportPassphrase.length < 8 ||
                exportPassphrase !== exportConfirm ||
                isExporting
              }
              className="flex items-center gap-2 bg-[#f54842] hover:bg-[#ff5a54] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#f54842]/20"
            >
              {isExporting ? (
                <span>Exporting...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Encrypted Vault (.privvault)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApplyRestore}
              disabled={!decryptedPayload || isApplying}
              className="flex items-center gap-2 bg-[#f54842] hover:bg-[#ff5a54] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#f54842]/20"
            >
              {isApplying ? (
                <span>Restoring...</span>
              ) : (
                <>
                  <span>Apply Restored State</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
