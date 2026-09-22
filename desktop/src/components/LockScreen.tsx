import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import {
  verifyPin,
  hashPin,
  generateSalt,
  saveLockConfig,
  loadLockConfig,
  recordFailedAttempt,
  resetFailedAttempts,
  getCooldownRemainingSeconds,
} from "../lib/sessionLock";

interface LockScreenProps {
  walletName: string;
  walletAddress?: string;
  onUnlock: () => void;
  onNotify?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  walletName,
  walletAddress = "",
  onUnlock,
  onNotify,
}) => {
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Setup mode (in case user locked without a pre-configured PIN)
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupPin, setSetupPin] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
    const config = loadLockConfig();
    if (!config.hasPin) {
      setIsSetupMode(true);
    }
  }, []);

  // Cooldown countdown effect
  useEffect(() => {
    const checkCooldown = () => {
      const remaining = getCooldownRemainingSeconds();
      setCooldownSeconds(remaining);
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cooldownSeconds > 0 || isVerifying || !pin.trim()) return;

    setErrorMessage("");
    setIsVerifying(true);

    try {
      const config = loadLockConfig();
      if (!config.pinHash || !config.pinSalt) {
        // No PIN configured - unlock directly
        resetFailedAttempts();
        onUnlock();
        return;
      }

      const isValid = await verifyPin(pin.trim(), config.pinSalt, config.pinHash);

      if (isValid) {
        resetFailedAttempts();
        setPin("");
        if (onNotify) {
          onNotify("success", "Workspace Unlocked", "Session restored successfully.");
        }
        onUnlock();
      } else {
        const { cooldownSeconds: newCooldown } = recordFailedAttempt();
        setPin("");
        if (newCooldown > 0) {
          setCooldownSeconds(newCooldown);
          setErrorMessage(`Too many failed attempts. Cooldown active for ${newCooldown}s.`);
        } else {
          setErrorMessage("Incorrect PIN. Please try again.");
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetupPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!setupPin || setupPin.length < 4) {
      setErrorMessage("PIN must be at least 4 digits or characters.");
      return;
    }
    if (setupPin !== setupConfirm) {
      setErrorMessage("PIN entries do not match.");
      return;
    }

    try {
      const salt = generateSalt();
      const hash = await hashPin(setupPin.trim(), salt);
      const currentConfig = loadLockConfig();

      saveLockConfig({
        ...currentConfig,
        enabled: true,
        pinHash: hash,
        pinSalt: salt,
        hasPin: true,
      });

      resetFailedAttempts();
      setIsSetupMode(false);
      setSetupPin("");
      setSetupConfirm("");
      if (onNotify) {
        onNotify("success", "PIN Configured", "Session PIN setup complete.");
      }
      onUnlock();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to set up PIN.");
    }
  };

  const handleQuickKeypad = (digit: string) => {
    if (cooldownSeconds > 0) return;
    if (pin.length < 12) {
      const newPin = pin + digit;
      setPin(newPin);
    }
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  return (
    <div
      style={{ backgroundColor: "#07080c" }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#07080c] text-white select-none p-4 animate-in fade-in duration-200"
    >
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        {/* Brand Header */}
        <div className="space-y-2 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#B91C3B]/10 border border-[#B91C3B]/30 flex items-center justify-center shadow-xl shadow-[#B91C3B]/10 mb-1">
            <Lock className="w-7 h-7 text-[#B91C3B]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">PRIVATUM</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Workstation Locked</span>
          </div>
        </div>

        {/* Account Info Card */}
        <div
          style={{ backgroundColor: "#12141a" }}
          className="w-full bg-[#12141a] border border-white/10 rounded-2xl p-4 flex items-center justify-between text-left"
        >
          <div className="space-y-0.5 min-w-0 pr-2">
            <div className="text-xs font-semibold text-white truncate">{walletName}</div>
            <div className="text-[11px] font-mono text-slate-400 truncate">
              {truncatedAddress || "Robinhood Chain"}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Cooldown Alert Banner */}
        {cooldownSeconds > 0 && (
          <div className="w-full bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-center gap-2 animate-in fade-in duration-150">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Lockout cooldown active: wait {cooldownSeconds}s before retrying</span>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && cooldownSeconds === 0 && (
          <div className="w-full bg-rose-500/10 border border-rose-500/25 rounded-xl p-2.5 text-xs text-rose-300 flex items-center justify-center gap-2 animate-in fade-in duration-150">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mode A: Standard Unlock Form */}
        {!isSetupMode ? (
          <form onSubmit={handleUnlock} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Enter Session PIN</span>
                <span className="text-[10px] font-mono text-slate-500">Press Enter to unlock</span>
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={cooldownSeconds > 0 || isVerifying}
                  placeholder="Enter PIN"
                  className="w-full bg-[#161822] border border-white/10 rounded-xl px-4 py-3 text-center text-lg font-mono text-white tracking-[0.25em] placeholder:tracking-normal placeholder:text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#B91C3B]/60 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Numeric Keypad for Touch / Mouse */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Unlock"].map(
                (btn) => {
                  if (btn === "Clear") {
                    return (
                      <button
                        key={btn}
                        type="button"
                        onClick={() => setPin("")}
                        disabled={cooldownSeconds > 0}
                        className="py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-slate-400 hover:text-white transition disabled:opacity-30 cursor-pointer"
                      >
                        Clear
                      </button>
                    );
                  }
                  if (btn === "Unlock") {
                    return (
                      <button
                        key={btn}
                        type="submit"
                        disabled={cooldownSeconds > 0 || isVerifying || !pin.trim()}
                        className="py-2.5 rounded-xl bg-[#B91C3B] hover:bg-[#C92040] text-xs font-semibold text-white transition disabled:opacity-30 flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-[#B91C3B]/20"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Go</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleQuickKeypad(btn)}
                      disabled={cooldownSeconds > 0}
                      className="py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-sm font-semibold font-mono text-slate-200 hover:text-white transition disabled:opacity-30 cursor-pointer border border-white/[0.03]"
                    >
                      {btn}
                    </button>
                  );
                }
              )}
            </div>
          </form>
        ) : (
          /* Mode B: First-Time PIN Setup Form */
          <form onSubmit={handleSetupPin} className="w-full space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-300 text-left flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Set a 4 to 8 digit PIN to protect your active workstation session against local access.
              </div>
            </div>

            <div className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Create New PIN</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value)}
                  placeholder="Enter 4-8 digit PIN"
                  className="w-full bg-[#161822] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#B91C3B]/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Confirm PIN</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  placeholder="Repeat PIN"
                  className="w-full bg-[#161822] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#B91C3B]/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!setupPin || setupPin.length < 4 || setupPin !== setupConfirm}
              className="w-full py-2.5 rounded-xl bg-[#B91C3B] hover:bg-[#C92040] text-xs font-semibold text-white transition disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-[#B91C3B]/20 cursor-pointer"
            >
              <span>Save PIN & Unlock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Security Footer Note */}
        <div className="text-[11px] text-slate-500 font-mono">
          <span>Client-side salted SHA-256</span>
          <span className="mx-2">•</span>
          <span>Zero network telemetry</span>
        </div>
      </div>
    </div>
  );
};
