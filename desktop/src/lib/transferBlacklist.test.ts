import { describe, it, expect, beforeEach } from "bun:test";
import {
  normalizeAddress,
  isValidAddress,
  loadCustomBlacklist,
  saveCustomBlacklist,
  getCuratedThreatFeed,
  getAllBlacklistEntries,
  checkAddressBlacklist,
  isAddressBlacklisted,
  addCustomBlacklistEntry,
  removeCustomBlacklistEntry,
  exportBlacklistJson,
  importBlacklistJson,
  CURATED_THREAT_FEED,
} from "./transferBlacklist";

describe("Transfer Blacklist Engine (v0.1.33)", () => {
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

  describe("Address Normalization & Validation", () => {
    it("normalizes addresses to lowercase trimmed strings", () => {
      expect(normalizeAddress(" 0xAbC1234567890123456789012345678901234567 ")).toBe(
        "0xabc1234567890123456789012345678901234567"
      );
      expect(normalizeAddress("")).toBe("");
    });

    it("validates 0x 40-hex address strings correctly", () => {
      expect(isValidAddress("0xd90e2f925da726b50c4ed8d0fb90ad053324f31b")).toBe(true);
      expect(isValidAddress("0xD90E2F925DA726B50C4ED8D0FB90AD053324F31B")).toBe(true);
      expect(isValidAddress("0x1234")).toBe(false);
      expect(isValidAddress("not-an-address")).toBe(false);
      expect(isValidAddress("0xzz0e2f925da726b50c4ed8d0fb90ad053324f31b")).toBe(false);
      expect(isValidAddress("")).toBe(false);
    });
  });

  describe("Curated Threat Intelligence Feed", () => {
    it("bundles high-severity curated threat entries", () => {
      const feed = getCuratedThreatFeed();
      expect(feed.length).toBeGreaterThanOrEqual(10);
      expect(feed.every((e) => e.source === "curated")).toBe(true);
      expect(feed.every((e) => isValidAddress(e.address))).toBe(true);
    });

    it("detects known Tornado Cash mixer contract", () => {
      const tornadoRouter = "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b";
      const verdict = checkAddressBlacklist(tornadoRouter);
      expect(verdict).not.toBeNull();
      expect(verdict?.isBlacklisted).toBe(true);
      expect(verdict?.entry?.category).toBe("Sanctioned");
      expect(verdict?.entry?.name).toBe("Tornado Cash Router");
    });

    it("detects known phishing drainers in case-insensitive manner", () => {
      const pinkDrainer = "0x0000490B8F4EBF2FFDC1FB66BC2F210515AA0000";
      expect(isAddressBlacklisted(pinkDrainer)).toBe(true);
      const verdict = checkAddressBlacklist(pinkDrainer);
      expect(verdict?.entry?.category).toBe("Phishing");
    });

    it("returns null for clean unlisted addresses", () => {
      const cleanAddress = "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae";
      expect(isAddressBlacklisted(cleanAddress)).toBe(false);
      expect(checkAddressBlacklist(cleanAddress)).toBeNull();
    });
  });

  describe("Custom Blacklist Management", () => {
    const testCustomAddr = "0x1111111111111111111111111111111111111111";

    it("starts with empty custom list in clean storage", () => {
      expect(loadCustomBlacklist()).toEqual([]);
    });

    it("adds a valid custom blacklist entry", () => {
      const result = addCustomBlacklistEntry({
        address: testCustomAddr,
        name: "Suspicious Counterparty",
        reason: "Requested unverified Telegram OTC trade",
        category: "Phishing",
      });

      expect(result.success).toBe(true);
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].address).toBe(testCustomAddr);
      expect(result.entries[0].source).toBe("user");

      const saved = loadCustomBlacklist();
      expect(saved.length).toBe(1);
      expect(saved[0].name).toBe("Suspicious Counterparty");
    });

    it("rejects invalid address when adding to blacklist", () => {
      const result = addCustomBlacklistEntry({
        address: "invalid-hex",
        reason: "Test",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid Ethereum address format");
      expect(loadCustomBlacklist()).toEqual([]);
    });

    it("deduplicates and updates existing custom entry with same address", () => {
      addCustomBlacklistEntry({
        address: testCustomAddr,
        name: "Initial Name",
        reason: "Initial Reason",
      });

      const updatedResult = addCustomBlacklistEntry({
        address: testCustomAddr.toUpperCase(),
        name: "Updated Name",
        reason: "Updated Reason",
        category: "Malicious",
      });

      expect(updatedResult.success).toBe(true);
      expect(updatedResult.entries.length).toBe(1);
      expect(updatedResult.entries[0].name).toBe("Updated Name");
      expect(updatedResult.entries[0].category).toBe("Malicious");
    });

    it("removes a custom blacklist entry", () => {
      addCustomBlacklistEntry({
        address: testCustomAddr,
        reason: "To be removed",
      });
      expect(loadCustomBlacklist().length).toBe(1);

      const remaining = removeCustomBlacklistEntry(testCustomAddr);
      expect(remaining.length).toBe(0);
      expect(loadCustomBlacklist().length).toBe(0);
      expect(isAddressBlacklisted(testCustomAddr)).toBe(false);
    });

    it("combines curated threat feed with user entries", () => {
      addCustomBlacklistEntry({
        address: testCustomAddr,
        name: "User Block",
        reason: "Custom test entry",
      });

      const all = getAllBlacklistEntries();
      expect(all.length).toBe(CURATED_THREAT_FEED.length + 1);
      expect(all.some((e) => e.address === testCustomAddr && e.source === "user")).toBe(true);
    });
  });

  describe("JSON Export & Import", () => {
    const addrA = "0x2222222222222222222222222222222222222222";
    const addrB = "0x3333333333333333333333333333333333333333";

    it("exports and imports custom blacklist entries accurately", () => {
      addCustomBlacklistEntry({
        address: addrA,
        name: "Drainer A",
        reason: "Fake mint site",
        category: "Phishing",
      });
      addCustomBlacklistEntry({
        address: addrB,
        name: "Compromised Multisig",
        reason: "Private key leaked",
        category: "Compromised",
      });

      const jsonString = exportBlacklistJson();
      expect(jsonString).toContain(addrA);
      expect(jsonString).toContain(addrB);
      expect(jsonString).toContain("0.1.33");

      // Clear local storage and import back
      localStorage.clear();
      expect(loadCustomBlacklist()).toEqual([]);

      const importRes = importBlacklistJson(jsonString);
      expect(importRes.success).toBe(true);
      expect(importRes.addedCount).toBe(2);

      const restored = loadCustomBlacklist();
      expect(restored.length).toBe(2);
      expect(isAddressBlacklisted(addrA)).toBe(true);
      expect(isAddressBlacklisted(addrB)).toBe(true);
    });

    it("handles corrupt JSON gracefully during import", () => {
      const res = importBlacklistJson("not valid json");
      expect(res.success).toBe(false);
      expect(res.addedCount).toBe(0);
      expect(res.error).toBeDefined();
    });

    it("ignores malformed address entries in imported array", () => {
      const partialValidJson = JSON.stringify([
        { address: addrA, name: "Good Entry", reason: "Valid" },
        { address: "bad-addr", name: "Bad Entry", reason: "Invalid" },
      ]);

      const res = importBlacklistJson(partialValidJson);
      expect(res.success).toBe(true);
      expect(res.addedCount).toBe(1);
      expect(loadCustomBlacklist().length).toBe(1);
    });
  });
});
