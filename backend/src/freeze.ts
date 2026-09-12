import { query } from "./db/index";
import { decryptSecret } from "./crypto";
import { base32Decode, verifyTotp } from "./totp";

/**
 * Panic Freeze.
 *
 * A frozen wallet is one the co-signer will not sign for. Because the account
 * is 2-of-3, withholding Shard B stops a transfer without ever being able to
 * cause one: a stolen freeze credential can deny the owner, never rob them.
 * That asymmetry is why freezing is allowed on a 6-digit code from any device,
 * while the key material stays untouched.
 *
 * Freezing is deliberately easier than unfreezing. Panic has no time for a
 * confirmation flow, and the dangerous direction is the one worth gating.
 */

/** Failed code attempts tolerated inside the window before the address is locked out. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Lockout window. */
export const ATTEMPT_WINDOW_MINUTES = 15;
/** Freeze durations the surfaces may request, in hours. `null` means until unfrozen. */
export const FREEZE_DURATIONS = [1, 24, 72] as const;
/** A freeze with no stated duration holds until the owner lifts it. */
export const INDEFINITE_YEARS = 100;

export type FreezeSource = "totp" | "session" | "panic_code";

export interface FreezeState {
  frozen: boolean;
  frozenUntil: string | null;
  frozenAt: string | null;
}

/**
 * Whether the co-signer must refuse. Read on every cosign request, so it stays
 * a single indexed lookup.
 */
export async function getFreezeState(address: string): Promise<FreezeState> {
  const { rows } = await query(
    "SELECT frozen_until, frozen_at FROM wallets WHERE address = $1",
    [address.toLowerCase()]
  );
  if (rows.length === 0) return { frozen: false, frozenUntil: null, frozenAt: null };

  const until: Date | null = rows[0].frozen_until;
  const frozen = until !== null && until.getTime() > Date.now();

  return {
    frozen,
    frozenUntil: frozen && until ? until.toISOString() : null,
    frozenAt: frozen && rows[0].frozen_at ? rows[0].frozen_at.toISOString() : null,
  };
}

/**
 * Whether this address has burned through its attempt budget.
 *
 * Counted per wallet rather than per IP: the owner may be freezing from a
 * borrowed phone on a network we have never seen, and an attacker rotating
 * addresses gains nothing because the code is what gates the action.
 */
export async function isLockedOut(address: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS failures
       FROM freeze_attempts
      WHERE wallet_address = $1
        AND succeeded = FALSE
        AND attempted_at > NOW() - INTERVAL '${ATTEMPT_WINDOW_MINUTES} minutes'`,
    [address.toLowerCase()]
  );
  return (rows[0]?.failures ?? 0) >= MAX_FAILED_ATTEMPTS;
}

async function recordAttempt(address: string, action: string, succeeded: boolean): Promise<void> {
  await query(
    "INSERT INTO freeze_attempts (wallet_address, action, succeeded) VALUES ($1, $2, $3)",
    [address.toLowerCase(), action, succeeded]
  );
}

/**
 * Verifies a 6-digit code against the wallet's enrolled authenticator.
 *
 * Returns the same negative result whether the wallet is unknown, has no TOTP
 * enrolled, or supplied a wrong code. A caller learns only that it failed,
 * which keeps the public endpoints from confirming that an address exists.
 */
export async function verifyFreezeCode(
  address: string,
  code: string,
  action: string
): Promise<boolean> {
  const addr = address.toLowerCase();

  if (!/^\d{6}$/.test(code)) {
    await recordAttempt(addr, action, false);
    return false;
  }

  const { rows } = await query(
    "SELECT totp_secret_encrypted, enabled FROM totp_recovery WHERE wallet_address = $1",
    [addr]
  );

  if (rows.length === 0 || !rows[0].enabled) {
    await recordAttempt(addr, action, false);
    return false;
  }

  let ok = false;
  try {
    const secret = base32Decode(decryptSecret(rows[0].totp_secret_encrypted));
    ok = verifyTotp(secret, code);
  } catch {
    ok = false;
  }

  await recordAttempt(addr, action, ok);
  return ok;
}

/** Freezes the wallet. `hours` of null holds it until the owner lifts it. */
export async function freezeWallet(
  address: string,
  hours: number | null,
  source: FreezeSource
): Promise<FreezeState> {
  const addr = address.toLowerCase();
  const until = new Date();
  if (hours === null) {
    until.setFullYear(until.getFullYear() + INDEFINITE_YEARS);
  } else {
    until.setTime(until.getTime() + hours * 3600 * 1000);
  }

  await query(
    `UPDATE wallets
        SET frozen_until = $2, frozen_at = NOW(), frozen_source = $3
      WHERE address = $1`,
    [addr, until, source]
  );
  await query(
    "INSERT INTO freeze_events (wallet_address, action, frozen_until, source) VALUES ($1, 'freeze', $2, $3)",
    [addr, until, source]
  );

  return getFreezeState(addr);
}

export async function unfreezeWallet(address: string, source: FreezeSource): Promise<FreezeState> {
  const addr = address.toLowerCase();
  await query(
    "UPDATE wallets SET frozen_until = NULL, frozen_at = NULL, frozen_source = NULL WHERE address = $1",
    [addr]
  );
  await query(
    "INSERT INTO freeze_events (wallet_address, action, frozen_until, source) VALUES ($1, 'unfreeze', NULL, $2)",
    [addr, source]
  );
  return getFreezeState(addr);
}
