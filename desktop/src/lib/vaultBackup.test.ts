import { describe, it, expect, beforeEach } from "bun:test";
import {
  encryptVault,
  decryptVault,
  gatherVaultState,
  summarizeVault,
  applyRestoredVault,
  VAULT_MAGIC_HEADER,
  type VaultStatePayload,
} from "./vaultBackup";

describe("Vault Backup & Restore Engine", () => {
  const testPassphrase = "SuperSecurePassword123!";
  const samplePayload: VaultStatePayload = {
    format: "privatum-encrypted-vault",
    version: "1.0",
    createdAt: 1710000000000,
    accounts: [
      {
        id: "primary",
        name: "Main Treasury",
        address: "0x1111111111111111111111111111111111111111",
        shardA: "shard_a_secret_hex",
        apiKey: "api_key_sample",
        totpEnrolled: true,
      },
      {
        id: "acc_2",
        name: "Ops Account",
        address: "0x2222222222222222222222222222222222222222",
        shardA: "shard_a_ops_hex",
      },
    ],
    activeAccountId: "primary",
    contacts: {
      "0x1111111111111111111111111111111111111111": [
        {
          id: "c1",
          name: "Acme Corp",
          address: "0x9999999999999999999999999999999999999999",
          category: "Vendor",
          createdAt: 1700000000000,
          starred: true,
        },
      ],
    },
    guardrails: {
      "0x1111111111111111111111111111111111111111": {
        maxPerTransaction: 10000,
        dailyLimit: 50000,
        monthlyLimit: 200000,
        strictMode: true,
      },
    },
    spendingHistory: {
      "0x1111111111111111111111111111111111111111": [
        {
          id: "s1",
          amount: 500,
          asset: "USDG",
          usdValue: 500,
          timestamp: 1710000000000,
          recipient: "0x9999999999999999999999999999999999999999",
        },
      ],
    },
    transactions: {
      "0x1111111111111111111111111111111111111111": [
        {
          id: "tx1",
          hash: "0xabcdef123456",
          type: "send",
          counterparty: "0x9999999999999999999999999999999999999999",
          amount: "500",
          asset: "USDG",
          timestamp: 1710000000000,
          status: "confirmed",
          tag: "Vendor",
          note: "Monthly SaaS subscription",
        },
      ],
    },
    metadata: {
      appVersion: "0.1.31",
    },
  };

  describe("AES-GCM-256 Encryption & Decryption", () => {
    it("successfully encrypts and decrypts valid payload round-trip", async () => {
      const plaintext = JSON.stringify(samplePayload);
      const encryptedContainer = await encryptVault(testPassphrase, plaintext);

      expect(encryptedContainer).toBeInstanceOf(Uint8Array);
      expect(encryptedContainer.length).toBeGreaterThan(VAULT_MAGIC_HEADER.length + 16 + 12);

      // Header verification
      const header = new TextDecoder().decode(
        encryptedContainer.slice(0, VAULT_MAGIC_HEADER.length)
      );
      expect(header).toBe(VAULT_MAGIC_HEADER);

      const decrypted = await decryptVault(testPassphrase, encryptedContainer);
      expect(decrypted).toBe(plaintext);

      const parsed = JSON.parse(decrypted);
      expect(parsed.format).toBe("privatum-encrypted-vault");
      expect(parsed.accounts).toHaveLength(2);
      expect(parsed.accounts[0].name).toBe("Main Treasury");
    });

    it("enforces minimum passphrase length of 8 characters", async () => {
      const plaintext = JSON.stringify(samplePayload);
      await expect(encryptVault("short", plaintext)).rejects.toThrow(
        "Passphrase must be at least 8 characters long."
      );
      await expect(encryptVault("", plaintext)).rejects.toThrow(
        "Passphrase must be at least 8 characters long."
      );
    });

    it("rejects decryption with incorrect passphrase", async () => {
      const plaintext = JSON.stringify(samplePayload);
      const encryptedContainer = await encryptVault(testPassphrase, plaintext);

      await expect(
        decryptVault("WrongPassword123!", encryptedContainer)
      ).rejects.toThrow("Decryption failed: incorrect passphrase or corrupted vault file.");
    });

    it("rejects corrupted or tampered ciphertext", async () => {
      const plaintext = JSON.stringify(samplePayload);
      const encryptedContainer = await encryptVault(testPassphrase, plaintext);

      // Tamper with ciphertext byte in the container
      const tampered = new Uint8Array(encryptedContainer);
      tampered[tampered.length - 5] ^= 0xff;

      await expect(decryptVault(testPassphrase, tampered)).rejects.toThrow(
        "Decryption failed: incorrect passphrase or corrupted vault file."
      );
    });

    it("rejects container with invalid magic header", async () => {
      const plaintext = JSON.stringify(samplePayload);
      const encryptedContainer = await encryptVault(testPassphrase, plaintext);

      // Corrupt magic header
      const tampered = new Uint8Array(encryptedContainer);
      tampered[0] = "X".charCodeAt(0);

      await expect(decryptVault(testPassphrase, tampered)).rejects.toThrow(
        "Invalid vault file: unrecognized format header."
      );
    });

    it("rejects payload that is truncated or too small", async () => {
      const tinyBytes = new Uint8Array([1, 2, 3]);
      await expect(decryptVault(testPassphrase, tinyBytes)).rejects.toThrow(
        "Invalid vault file: payload is too small or truncated."
      );
    });
  });

  describe("Vault Summary", () => {
    it("calculates accurate summary counts across accounts", () => {
      const summary = summarizeVault(samplePayload);
      expect(summary.accountCount).toBe(2);
      expect(summary.totalContacts).toBe(1);
      expect(summary.totalTransactions).toBe(1);
      expect(summary.appVersion).toBe("0.1.31");
      expect(summary.accounts).toEqual([
        { id: "primary", name: "Main Treasury", address: "0x1111111111111111111111111111111111111111" },
        { id: "acc_2", name: "Ops Account", address: "0x2222222222222222222222222222222222222222" },
      ]);
    });

    it("handles empty payloads without errors", () => {
      const emptyPayload: VaultStatePayload = {
        format: "privatum-encrypted-vault",
        version: "1.0",
        createdAt: 1710000000000,
        accounts: [],
        activeAccountId: "primary",
        contacts: {},
        guardrails: {},
        spendingHistory: {},
        transactions: {},
      };
      const summary = summarizeVault(emptyPayload);
      expect(summary.accountCount).toBe(0);
      expect(summary.totalContacts).toBe(0);
      expect(summary.totalTransactions).toBe(0);
    });
  });

  describe("State Gathering & Local Storage Application", () => {
    const memoryStore: Record<string, string> = {};

    beforeEach(() => {
      for (const k of Object.keys(memoryStore)) {
        delete memoryStore[k];
      }

      // Mock global localStorage
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

    it("gathers complete state from localStorage", () => {
      const addr = "0x1111111111111111111111111111111111111111";
      memoryStore["privatum_accounts"] = JSON.stringify([
        { id: "primary", name: "Test Primary", address: addr },
      ]);
      memoryStore["privatum_active_account_id"] = "primary";
      memoryStore["privatum_shard_a"] = "shardAVal";
      memoryStore[`privatum_contacts_${addr}`] = JSON.stringify([
        { id: "c1", name: "Alice", address: "0x3333333333333333333333333333333333333333", createdAt: 123 },
      ]);
      memoryStore[`privatum_transactions_${addr}`] = JSON.stringify([
        { id: "tx1", hash: "0xabc", type: "send", amount: "10", asset: "USDG", timestamp: 123, counterparty: "0x3333333333333333333333333333333333333333", status: "confirmed" },
      ]);

      const state = gatherVaultState("0.1.31");
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].name).toBe("Test Primary");
      expect(state.accounts[0].shardA).toBe("shardAVal");
      expect(state.contacts[addr]).toHaveLength(1);
      expect(state.transactions[addr]).toHaveLength(1);
      expect(state.metadata?.appVersion).toBe("0.1.31");
    });

    it("restores state in overwrite mode", () => {
      const res = applyRestoredVault(samplePayload, "overwrite");
      expect(res.accountsRestored).toBe(2);
      expect(res.contactsRestored).toBe(1);
      expect(res.transactionsRestored).toBe(1);

      const restoredAccounts = JSON.parse(memoryStore["privatum_accounts"]);
      expect(restoredAccounts).toHaveLength(2);
      expect(memoryStore["privatum_shard_a_primary"]).toBe("shard_a_secret_hex");
      expect(memoryStore["privatum_shard_a"]).toBe("shard_a_secret_hex");
    });

    it("restores state in merge mode without duplicating existing accounts or records", () => {
      const addr1 = "0x1111111111111111111111111111111111111111";
      memoryStore["privatum_accounts"] = JSON.stringify([
        { id: "primary", name: "Existing Primary", address: addr1 },
      ]);
      memoryStore[`privatum_contacts_${addr1}`] = JSON.stringify([
        { id: "c1", name: "Existing Acme", address: "0x9999999999999999999999999999999999999999", createdAt: 100 },
      ]);

      const res = applyRestoredVault(samplePayload, "merge");
      expect(res.accountsRestored).toBe(2);

      const accounts = JSON.parse(memoryStore["privatum_accounts"]);
      // 1 existing + 1 new from samplePayload ('acc_2')
      expect(accounts).toHaveLength(2);
      expect(accounts[0].name).toBe("Existing Primary");
      expect(accounts[1].id).toBe("acc_2");

      // Contacts should be deduplicated by address
      const contacts = JSON.parse(memoryStore[`privatum_contacts_${addr1}`]);
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe("Existing Acme");
    });
  });
});
