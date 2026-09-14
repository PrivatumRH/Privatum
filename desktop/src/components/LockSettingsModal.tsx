import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Clock,
  ShieldCheck,
  Check,
  AlertTriangle,
  KeyRound,
  Trash2,
} from "lucide-react";
import {
  loadLockConfig,
  saveLockConfig,
  clearLockPin,
  hashPin,
  generateSalt,
  verifyPin,
  type SessionLockConfig,
} from "../lib/sessionLock";

interface LockSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLockNow?: () => void;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
  pendingLock?: boolean;
  onPinConfigured?: () => void;
}

const TIMEOUT_OPTIONS = [
  { value: 1, label: "1 minute (Testing)" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes (Default)" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 0, label: "Never (Manual lock only)" },
];

export const LockSettingsModal: React.FC<LockSettingsModalProps> = ({
  isOpen,
  onClose,
  onLockNow,
  onNotify,
  pendingLock,
  onPinConfigured,
}) => {
  const [config, setConfig] = useState<SessionLockConfig>(loadLockConfig());

  // Form states
  const [autoLockEnabled, setAutoLockEnabled] = useState(config.enabled);
  const [timeoutMinutes, setTimeoutMinutes] = useState(config.timeoutMinutes);

  // PIN change states
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = loadLockConfig();
      setConfig(current);
      setAutoLockEnabled(current.enabled);
      setTimeoutMinutes(current.timeoutMinutes);
      setIsChangingPin(!current.hasPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setPinError("");
    setIsSaving(true);

    try {
      let finalPinHash = config.pinHash;
      let finalPinSalt = config.pinSalt;

      // If user is setting or changing PIN
      if (newPin.trim()) {
        if (newPin.length < 4) {
          setPinError("New PIN must be at least 4 characters long.");
          setIsSaving(false);
          return;
        }
        if (newPin !== confirmPin) {
          setPinError("New PIN entries do not match.");
          setIsSaving(false);
          return;
        }

        // If updating an existing PIN, verify current PIN
        if (config.hasPin && config.pinSalt && config.pinHash) {
          const isValid = await verifyPin(currentPin.trim(), config.pinSalt, config.pinHash);
          if (!isValid) {
            setPinError("Current PIN is incorrect.");
            setIsSaving(false);
            return;
          }
        }

        const salt = generateSalt();
        finalPinHash = await hashPin(newPin.trim(), salt);
        finalPinSalt = salt;
      }

      const updated: SessionLockConfig = {
        enabled: autoLockEnabled,
        timeoutMinutes,
        pinHash: finalPinHash,
        pinSalt: finalPinSalt,
        hasPin: Boolean(finalPinHash && finalPinSalt),
      };

      saveLockConfig(updated);
      setConfig(updated);

      if (onNotify) {
        onNotify("success", "Security Updated", "Workstation auto-lock preferences saved.");
      }
      onClose();
      if (pendingLock && updated.hasPin && onPinConfigured) {
        onPinConfigured();
      }
    } catch (err: any) {
      setPinError(err?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePin = () => {
    if (window.confirm("Remove PIN protection? This will disable auto-lock.")) {
      clearLockPin();
      setConfig(loadLockConfig());
      setAutoLockEnabled(false);
      setIsChangingPin(true);
      if (onNotify) {
        onNotify("info", "PIN Removed", "Workstation PIN protection cleared.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl max-w-lg w-full flex flex-col max-h-[90vh] text-white shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-white/[0.08] flex-shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#f54842]" />
              <h3 className="text-base font-semibold text-white">Workstation Auto-Lock</h3>
            </div>
            <p className="text-xs text-slate-400">
              Configure session inactivity timeout and salted PIN screen protection.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-grow">
          {pendingLock && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">Passcode Required</div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  Please configure a session PIN before locking your workstation. Your workspace will automatically lock after saving.
                </div>
              </div>
            </div>
          )}

          {/* Quick Lock Action Card */}
          <div className="bg-[#181a24] border border-white/[0.08] rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-white">Manual Quick Lock</div>
              <div className="text-[11px] text-slate-400">
                Lock your workstation immediately using hotkey <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">L</kbd>
              </div>
            </div>
            {onLockNow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockNow();
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Now</span>
              </button>
            )}
          </div>

          {/* Auto-Lock Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="space-y-0.5 pr-4">
              <div className="text-xs font-semibold text-white">Enable Inactivity Auto-Lock</div>
              <div className="text-[11px] text-slate-400">
                Automatically display the lock screen when no mouse or keyboard input is detected.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoLockEnabled}
                onChange={(e) => setAutoLockEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f54842]" />
            </label>
          </div>

          {/* Timeout Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Inactivity Duration Threshold</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIMEOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTimeoutMinutes(opt.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    timeoutMinutes === opt.value
                      ? "bg-white/[0.08] border-[#f54842] text-white"
                      : "bg-[#181a24] border-white/5 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <div className="text-xs font-medium flex items-center justify-between">
                    <span>{opt.label}</span>
                    {timeoutMinutes === opt.value && <Check className="w-3 h-3 text-[#f54842]" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PIN Setup & Management */}
          <div className="space-y-3 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>Session Unlock PIN</span>
              </div>
              {config.hasPin && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition flex items-center gap-1"
                    title="Clear PIN"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              )}
            </div>

            {config.hasPin && !isChangingPin ? (
              <div className="flex items-center justify-between bg-[#181a24] border border-white/5 rounded-xl p-3 text-xs">
                <span className="text-slate-400">PIN is configured and protecting your workspace.</span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-xs text-[#f54842] hover:text-[#ff5a54] font-medium"
                >
                  Change PIN
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 bg-[#181a24] border border-white/[0.08] rounded-xl p-3.5">
                {config.hasPin && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Current PIN</label>
                    <input
                      type="password"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="Enter current PIN"
                      className="w-full bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    {config.hasPin ? "New PIN" : "Create Session PIN"}
                  </label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Enter 4-8 digit PIN"
                    className="w-full bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Confirm PIN</label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="Repeat PIN"
                    className="w-full bg-[#12141a] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#f54842]/50"
                  />
                </div>

                {pinError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" /> {pinError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed">
              PINs are salted and hashed client-side with native Web Crypto SHA-256. Zero data or
              telemetry is transmitted over the network.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/[0.08] bg-[#0c0d12] flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#f54842] hover:bg-[#ff5a54] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-[#f54842]/20 cursor-pointer"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <span>{pendingLock ? "Save PIN & Lock Workspace" : "Save Preferences"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
