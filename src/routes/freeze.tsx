import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Lock, LockOpen, Loader2 } from "lucide-react";

/**
 * The panic surface.
 *
 * Reached from a phone while the device holding Shard A is gone, so it asks for
 * no session: a session is the one thing a thief already has. The authenticator
 * code is the credential, and it authorises a state flag rather than any
 * movement of funds - the co-signer stops signing, and a 2-of-3 account cannot
 * settle on one signature.
 */

export const Route = createFileRoute("/freeze")({
  component: FreezeComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    w: typeof search.w === "string" ? search.w : "",
  }),
});

// Canonical co-signer origin, matching DEFAULT_API_URL in the SDK. The previous
// fallback pointed at a Render host that no longer serves the API, and
// VITE_BACKEND_URL is not set in the deployed environment, so the fallback is
// what production actually uses.
const API_BASE = import.meta.env.VITE_BACKEND_URL || "https://api.privatumrh.com";

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "Until I unlock", hours: null },
];

interface FreezeState {
  frozen: boolean;
  frozenUntil: string | null;
}

function isAddressLike(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function countdown(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expiring now.";
  const days = Math.floor(ms / 86400000);
  if (days > 365) return "It stays frozen until you unlock it.";
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h remaining.`;
  if (hours > 0) return `${hours}h ${minutes}m remaining.`;
  return `${minutes}m remaining.`;
}

function FreezeComponent() {
  const { w } = useSearch({ from: "/freeze" });

  const [address, setAddress] = useState(w || "");
  const [code, setCode] = useState("");
  const [hours, setHours] = useState<number | null>(24);
  const [state, setState] = useState<FreezeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Remember the wallet on this device so the next panic is one tap.
  useEffect(() => {
    if (w && isAddressLike(w)) {
      try {
        localStorage.setItem("privatum_freeze_wallet", w);
      } catch {
        // Private browsing: the address just has to be typed.
      }
      return;
    }
    try {
      const saved = localStorage.getItem("privatum_freeze_wallet");
      if (saved) setAddress((current) => current || saved);
    } catch {
      // Nothing remembered; the field stays empty.
    }
  }, [w]);

  // Keep the countdown honest without refetching.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isAddressLike(address)) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/wallets/${address.trim()}/freeze`);
        if (res.ok && !cancelled) setState(await res.json());
      } catch {
        // A failed status read must never stand between the owner and the
        // freeze button.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const submit = async (action: "freeze" | "unfreeze") => {
    setError(null);

    if (!isAddressLike(address)) {
      setError("Enter the wallet address you want to protect.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/wallets/${address.trim()}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "freeze" ? { code, hours } : { code }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Wait 15 minutes and try again."
            : "That code was not accepted. Check your authenticator and try again."
        );
        return;
      }

      setState({ frozen: body.frozen, frozenUntil: body.frozenUntil });
      setCode("");
    } catch {
      setError("Could not reach the co-signer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const frozen = state?.frozen === true;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f5f8] text-[#0e121b] font-['Inter',sans-serif] p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-[rgba(14,18,27,0.08)] rounded-2xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(14,18,27,0.07)]">
        <div className="flex items-center justify-between pb-5 border-b border-[rgba(14,18,27,0.08)]">
          <a
            href="/"
            className="inline-flex items-center gap-2.5 text-[#0e121b] font-semibold text-base tracking-tight"
          >
            <span className="w-6 h-6 rounded-md bg-[#0e121b] text-white grid place-items-center text-xs font-bold">
              P
            </span>
            PRIVATUM
          </a>
          <span className="text-[11px] text-[#687182]">Emergency controls</span>
        </div>

        <div className="pt-6">
          <div
            className={`w-12 h-12 rounded-full grid place-items-center mx-auto mb-4 ${
              frozen ? "bg-[#fdeceb] text-[#c0392b]" : "bg-[#eaf8ef] text-[#168247]"
            }`}
          >
            {frozen ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-center mb-1">
            {frozen ? "This wallet is frozen" : "Freeze your wallet"}
          </h1>
          <p className="text-sm text-[#687182] text-center mb-6">
            {frozen
              ? `The co-signer is refusing to sign. ${countdown(state?.frozenUntil ?? null)}`
              : "The co-signer stops signing immediately. Your funds never move and no key leaves your devices."}
          </p>

          <label className="block text-[11px] font-medium text-[#687182] mb-1.5">
            Wallet address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
            className="w-full px-3.5 py-2.5 mb-4 rounded-xl bg-[#fafbfc] border border-[rgba(14,18,27,0.12)] text-sm font-mono tracking-tight outline-none focus:border-[#0e121b] transition-colors"
          />

          {!frozen && (
            <>
              <label className="block text-[11px] font-medium text-[#687182] mb-1.5">
                Freeze for
              </label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setHours(d.hours)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      hours === d.hours
                        ? "bg-[#0e121b] text-white border-[#0e121b]"
                        : "bg-white text-[#0e121b] border-[rgba(14,18,27,0.12)] hover:bg-[#fafbfc]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="block text-[11px] font-medium text-[#687182] mb-1.5">
            6-digit code from your authenticator
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            className="w-full px-3.5 py-2.5 mb-4 rounded-xl bg-[#fafbfc] border border-[rgba(14,18,27,0.12)] text-lg font-mono tracking-[0.3em] text-center outline-none focus:border-[#0e121b] transition-colors"
          />

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#fdeceb] border border-[rgba(192,57,43,0.2)] text-xs text-[#c0392b]">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => submit(frozen ? "unfreeze" : "freeze")}
            className={`w-full py-3 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              frozen ? "bg-[#168247] hover:bg-[#11673a]" : "bg-[#c0392b] hover:bg-[#a53024]"
            }`}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : frozen ? (
              <LockOpen className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {busy ? "Working..." : frozen ? "Unlock wallet" : "Freeze wallet now"}
          </button>

          <p className="text-[11px] text-[#687182] text-center mt-4 leading-relaxed">
            Freezing withholds one of three key shards. It can stop a transfer, and it can never
            move your funds - not by us, and not by anyone holding this page.
          </p>
        </div>
      </div>

      <p className="text-[11px] text-[#9aa4b2] mt-5 text-center max-w-md">
        Lost your device? Freeze first, then rotate your keys from a machine you trust.
      </p>
    </div>
  );
}
