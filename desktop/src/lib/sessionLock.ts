/**
 * Workstation Auto-Lock and Session Security Engine for PRIVATUM Desktop.
 *
 * Implements client-side salted SHA-256 PIN authentication, inactivity
 * detection, and progressive brute-force cooldowns with zero external telemetry.
 */

export const STORAGE_KEY_LOCK_CONFIG = "privatum_session_lock";
export const STORAGE_KEY_FAILED_ATTEMPTS = "privatum_lock_failed_attempts";
export const STORAGE_KEY_COOLDOWN_UNTIL = "privatum_lock_cooldown_until";

export interface SessionLockConfig {
  enabled: boolean;
  timeoutMinutes: number; // 1, 5, 15, 30, 60. 0 = never auto-lock
  pinHash?: string;
  pinSalt?: string;
  hasPin: boolean;
}

export const DEFAULT_LOCK_CONFIG: SessionLockConfig = {
  enabled: false,
  timeoutMinutes: 15,
  hasPin: false,
};

/**
 * Generates a cryptographically random 16-byte hex salt string.
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for non-browser/test environments if needed
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives a 64-character lowercase hexadecimal digest using SHA-256 over pin + ":" + salt.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const cleanPin = pin.trim();
  const cleanSalt = salt.trim();
  const enc = new TextEncoder();
  const data = enc.encode(`${cleanPin}:${cleanSalt}`);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  throw new Error("Web Crypto API (crypto.subtle) is not available.");
}

/**
 * Timing-safe constant-time verification of entered PIN against stored salt and expected hash.
 */
export async function verifyPin(
  enteredPin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!enteredPin || !salt || !expectedHash) return false;
  const computedHash = await hashPin(enteredPin, salt);
  if (computedHash.length !== expectedHash.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Checks whether user inactivity has surpassed the configured auto-lock threshold.
 */
export function isSessionExpired(
  lastActivityTimestamp: number,
  timeoutMinutes: number,
  currentTimestamp: number = Date.now()
): boolean {
  if (timeoutMinutes <= 0) return false;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  return currentTimestamp - lastActivityTimestamp >= timeoutMs;
}

/**
 * Loads the current session lock configuration from localStorage.
 */
export function loadLockConfig(): SessionLockConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_LOCK_CONFIG };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCK_CONFIG);
    if (!raw) return { ...DEFAULT_LOCK_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      timeoutMinutes: typeof parsed.timeoutMinutes === "number" ? parsed.timeoutMinutes : 15,
      pinHash: parsed.pinHash || undefined,
      pinSalt: parsed.pinSalt || undefined,
      hasPin: Boolean(parsed.pinHash && parsed.pinSalt),
    };
  } catch {
    return { ...DEFAULT_LOCK_CONFIG };
  }
}

/**
 * Persists session lock configuration to localStorage.
 */
export function saveLockConfig(config: SessionLockConfig): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const data = {
    enabled: config.enabled,
    timeoutMinutes: config.timeoutMinutes,
    pinHash: config.pinHash,
    pinSalt: config.pinSalt,
  };
  localStorage.setItem(STORAGE_KEY_LOCK_CONFIG, JSON.stringify(data));
}

/**
 * Clears the configured PIN and disables session lock.
 */
export function clearLockPin(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  saveLockConfig({
    enabled: false,
    timeoutMinutes: 15,
    hasPin: false,
  });
  resetFailedAttempts();
}

/**
 * Returns remaining cooldown seconds if temporarily locked out, or 0 if active.
 */
export function getCooldownRemainingSeconds(now: number = Date.now()): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COOLDOWN_UNTIL);
    if (!raw) return 0;
    const cooldownUntil = parseInt(raw, 10);
    if (isNaN(cooldownUntil)) return 0;
    const diff = Math.ceil((cooldownUntil - now) / 1000);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a failed unlock attempt and escalates cooldown penalty:
 * 3 consecutive failures -> 10s cooldown
 * 5+ consecutive failures -> 30s cooldown
 */
export function recordFailedAttempt(now: number = Date.now()): {
  failedCount: number;
  cooldownSeconds: number;
} {
  if (typeof window === "undefined" || !window.localStorage) {
    return { failedCount: 1, cooldownSeconds: 0 };
  }

  let count = 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAILED_ATTEMPTS);
    count = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {}

  count += 1;
  localStorage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, count.toString());

  let cooldownSeconds = 0;
  if (count >= 5) {
    cooldownSeconds = 30;
  } else if (count >= 3) {
    cooldownSeconds = 10;
  }

  if (cooldownSeconds > 0) {
    const cooldownUntil = now + cooldownSeconds * 1000;
    localStorage.setItem(STORAGE_KEY_COOLDOWN_UNTIL, cooldownUntil.toString());
  }

  return { failedCount: count, cooldownSeconds };
}

/**
 * Resets failed attempts counter and clears cooldown timestamp.
 */
export function resetFailedAttempts(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  localStorage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
  localStorage.removeItem(STORAGE_KEY_COOLDOWN_UNTIL);
}
