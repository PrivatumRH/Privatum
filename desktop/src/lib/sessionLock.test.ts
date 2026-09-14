import { describe, it, expect, beforeEach } from "bun:test";
import {
  generateSalt,
  hashPin,
  verifyPin,
  isSessionExpired,
  loadLockConfig,
  saveLockConfig,
  clearLockPin,
  recordFailedAttempt,
  getCooldownRemainingSeconds,
  resetFailedAttempts,
  DEFAULT_LOCK_CONFIG,
  type SessionLockConfig,
} from "./sessionLock";

describe("Workstation Session Lock Engine", () => {
  const memoryStore: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => {
        memoryStore[k] = v;
      },
      removeItem: (k: string) => {
        delete memoryStore[k];
      },
      clear: () => {
        for (const k of Object.keys(memoryStore)) delete memoryStore[k];
      },
    };
  });

  describe("Salt Generation & SHA-256 Hashing", () => {
    it("generates a 32-character hexadecimal random salt", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1).toHaveLength(32);
      expect(salt2).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(salt1)).toBe(true);
      expect(salt1).not.toBe(salt2);
    });

    it("produces deterministic 64-character lowercase hexadecimal hash", async () => {
      const salt = "0123456789abcdef0123456789abcdef";
      const hash1 = await hashPin("123456", salt);
      const hash2 = await hashPin("123456", salt);

      expect(hash1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
      expect(hash1).toBe(hash2);
    });

    it("yields distinct hashes for different PINs or salts", async () => {
      const saltA = generateSalt();
      const saltB = generateSalt();

      const hashA = await hashPin("1234", saltA);
      const hashB = await hashPin("5678", saltA);
      const hashC = await hashPin("1234", saltB);

      expect(hashA).not.toBe(hashB);
      expect(hashA).not.toBe(hashC);
    });
  });

  describe("PIN Verification", () => {
    it("verifies matching PIN successfully", async () => {
      const pin = "7890";
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);

      const isValid = await verifyPin(pin, salt, hash);
      expect(isValid).toBe(true);
    });

    it("rejects non-matching PIN", async () => {
      const pin = "7890";
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);

      const isValid = await verifyPin("0000", salt, hash);
      expect(isValid).toBe(false);
    });

    it("rejects empty or falsy inputs", async () => {
      expect(await verifyPin("", "salt", "hash")).toBe(false);
      expect(await verifyPin("1234", "", "hash")).toBe(false);
      expect(await verifyPin("1234", "salt", "")).toBe(false);
    });
  });

  describe("Inactivity Session Expiration", () => {
    const baseTime = 1000000;

    it("returns false if timeoutMinutes is 0 or negative (never lock)", () => {
      expect(isSessionExpired(baseTime, 0, baseTime + 100000000)).toBe(false);
      expect(isSessionExpired(baseTime, -1, baseTime + 100000000)).toBe(false);
    });

    it("returns false if elapsed time is less than timeout", () => {
      const fiveMinsMs = 5 * 60 * 1000;
      // 4 minutes elapsed
      const currentTime = baseTime + (fiveMinsMs - 1000);
      expect(isSessionExpired(baseTime, 5, currentTime)).toBe(false);
    });

    it("returns true once elapsed time reaches or exceeds timeout", () => {
      const fiveMinsMs = 5 * 60 * 1000;
      // Exact threshold
      expect(isSessionExpired(baseTime, 5, baseTime + fiveMinsMs)).toBe(true);
      // Exceeded threshold
      expect(isSessionExpired(baseTime, 5, baseTime + fiveMinsMs + 5000)).toBe(true);
    });
  });

  describe("Configuration Persistence", () => {
    it("loads default config when storage is empty", () => {
      const cfg = loadLockConfig();
      expect(cfg).toEqual(DEFAULT_LOCK_CONFIG);
      expect(cfg.hasPin).toBe(false);
    });

    it("saves and reloads custom lock configuration", () => {
      const customConfig: SessionLockConfig = {
        enabled: true,
        timeoutMinutes: 30,
        pinHash: "hash123",
        pinSalt: "salt123",
        hasPin: true,
      };
      saveLockConfig(customConfig);

      const loaded = loadLockConfig();
      expect(loaded.enabled).toBe(true);
      expect(loaded.timeoutMinutes).toBe(30);
      expect(loaded.pinHash).toBe("hash123");
      expect(loaded.pinSalt).toBe("salt123");
      expect(loaded.hasPin).toBe(true);
    });

    it("clears PIN and resets lock config", () => {
      saveLockConfig({
        enabled: true,
        timeoutMinutes: 15,
        pinHash: "abc",
        pinSalt: "def",
        hasPin: true,
      });

      clearLockPin();
      const reloaded = loadLockConfig();
      expect(reloaded.enabled).toBe(false);
      expect(reloaded.hasPin).toBe(false);
      expect(reloaded.pinHash).toBeUndefined();
    });
  });

  describe("Lockout Cooldown Escalation", () => {
    const fixedTime = 1700000000000;

    it("tracks failed attempts and escalates lockout penalties", () => {
      // 1st failure
      const r1 = recordFailedAttempt(fixedTime);
      expect(r1.failedCount).toBe(1);
      expect(r1.cooldownSeconds).toBe(0);
      expect(getCooldownRemainingSeconds(fixedTime)).toBe(0);

      // 2nd failure
      const r2 = recordFailedAttempt(fixedTime);
      expect(r2.failedCount).toBe(2);
      expect(r2.cooldownSeconds).toBe(0);

      // 3rd failure -> 10s cooldown
      const r3 = recordFailedAttempt(fixedTime);
      expect(r3.failedCount).toBe(3);
      expect(r3.cooldownSeconds).toBe(10);
      expect(getCooldownRemainingSeconds(fixedTime)).toBe(10);
      expect(getCooldownRemainingSeconds(fixedTime + 4000)).toBe(6);
      expect(getCooldownRemainingSeconds(fixedTime + 11000)).toBe(0);

      // 4th failure
      recordFailedAttempt(fixedTime);

      // 5th failure -> 30s cooldown
      const r5 = recordFailedAttempt(fixedTime);
      expect(r5.failedCount).toBe(5);
      expect(r5.cooldownSeconds).toBe(30);
      expect(getCooldownRemainingSeconds(fixedTime)).toBe(30);
    });

    it("resets failed attempts and active cooldown", () => {
      recordFailedAttempt(fixedTime);
      recordFailedAttempt(fixedTime);
      recordFailedAttempt(fixedTime);
      expect(getCooldownRemainingSeconds(fixedTime)).toBe(10);

      resetFailedAttempts();
      expect(getCooldownRemainingSeconds(fixedTime)).toBe(0);
    });
  });
});
