/**
 * One-Click Encrypted Full-State Backup & Restore for PRIVATUM Desktop.
 *
 * Implements client-side authenticated AES-GCM-256 encryption via native Web Crypto API.
 * Encrypts keychain accounts, Shard A keys, private contacts, spending guardrails,
 * and transaction history with 100,000-iteration PBKDF2 key derivation.
 * Zero external telemetry or server transmission.
 */

import type { Contact } from "./contacts";
import type { SpendingGuardrailConfig, SpendingRecord } from "./spendGuardrails";
import type { TransactionTag } from "./transactionTags";

export interface TransactionRecord {
  id: string;
  hash: string;
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: "USDG" | "ETH";
  timestamp: number;
  status: "confirmed" | "pending";
  tag?: TransactionTag;
  note?: string;
  usdValue?: string;
}

export const VAULT_MAGIC_HEADER = "PRIVVAULT1"; // 10 bytes ASCII
export const PBKDF2_ITERATIONS = 100000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export interface VaultAccountData {
  id: string;
  name: string;
  address: string;
  shardA: string;
  shardBAddress?: string;
  shardCAddress?: string;
  apiKey?: string;
  totpEnrolled?: boolean;
}

export interface VaultStatePayload {
  format: "privatum-encrypted-vault";
  version: "1.0";
  createdAt: number;
  accounts: VaultAccountData[];
  activeAccountId: string;
  contacts: Record<string, Contact[]>; // address -> Contact[]
  guardrails: Record<string, SpendingGuardrailConfig>; // address -> config
  spendingHistory: Record<string, SpendingRecord[]>; // address -> history
  transactions: Record<string, TransactionRecord[]>; // address -> tx[]
  metadata?: {
    appVersion: string;
  };
}

export interface VaultSummary {
  accountCount: number;
  totalContacts: number;
  totalTransactions: number;
  createdAt: number;
  appVersion?: string;
  accounts: { id: string; name: string; address: string }[];
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user passphrase and salt using PBKDF2.
 */
async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array,
  usage: "encrypt" | "decrypt"
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

/**
 * Encrypts a plaintext string into a binary PRIVVAULT1 container.
 */
export async function encryptVault(passphrase: string, plaintext: string): Promise<Uint8Array> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters long.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveVaultKey(passphrase, salt, "encrypt");

  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const headerBytes = new TextEncoder().encode(VAULT_MAGIC_HEADER);

  const totalLength = headerBytes.length + salt.length + iv.length + ciphertext.length;
  const container = new Uint8Array(totalLength);

  let offset = 0;
  container.set(headerBytes, offset);
  offset += headerBytes.length;

  container.set(salt, offset);
  offset += salt.length;

  container.set(iv, offset);
  offset += iv.length;

  container.set(ciphertext, offset);

  return container;
}

/**
 * Decrypts a binary PRIVVAULT1 container back into plaintext string.
 */
export async function decryptVault(
  passphrase: string,
  vaultData: ArrayBuffer | Uint8Array
): Promise<string> {
  if (!passphrase) {
    throw new Error("Passphrase is required.");
  }

  const bytes = vaultData instanceof Uint8Array ? vaultData : new Uint8Array(vaultData);
  const headerBytes = new TextEncoder().encode(VAULT_MAGIC_HEADER);
  const minLength = headerBytes.length + SALT_BYTES + IV_BYTES + 16; // 16 bytes for GCM auth tag

  if (bytes.length < minLength) {
    throw new Error("Invalid vault file: payload is too small or truncated.");
  }

  // Validate magic header
  const fileHeader = new TextDecoder().decode(bytes.slice(0, headerBytes.length));
  if (fileHeader !== VAULT_MAGIC_HEADER) {
    throw new Error("Invalid vault file: unrecognized format header.");
  }

  let offset = headerBytes.length;
  const salt = bytes.slice(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;

  const iv = bytes.slice(offset, offset + IV_BYTES);
  offset += IV_BYTES;

  const ciphertext = bytes.slice(offset);

  const key = await deriveVaultKey(passphrase, salt, "decrypt");

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error("Decryption failed: incorrect passphrase or corrupted vault file.");
  }
}

/**
 * Gathers complete application state from local storage into a structured VaultStatePayload.
 */
export function gatherVaultState(appVersion = "0.1.31"): VaultStatePayload {
  if (typeof window === "undefined") {
    return {
      format: "privatum-encrypted-vault",
      version: "1.0",
      createdAt: Date.now(),
      accounts: [],
      activeAccountId: "primary",
      contacts: {},
      guardrails: {},
      spendingHistory: {},
      transactions: {},
      metadata: { appVersion },
    };
  }

  let rawAccounts: any[] = [];
  try {
    const raw = localStorage.getItem("privatum_accounts");
    if (raw) rawAccounts = JSON.parse(raw);
  } catch {}

  const activeAccountId = localStorage.getItem("privatum_active_account_id") || "primary";

  // Fallback: if privatum_accounts is empty but primary exists
  if (rawAccounts.length === 0) {
    const primaryAddr = localStorage.getItem("privatum_wallet_address");
    const primaryShardA = localStorage.getItem("privatum_shard_a");
    if (primaryAddr && primaryShardA) {
      rawAccounts.push({
        id: "primary",
        name: "Primary Account",
        address: primaryAddr,
      });
    }
  }

  const accounts: VaultAccountData[] = rawAccounts.map((acc) => {
    const targetId = acc.id;
    const cleanAddr = acc.address ? acc.address.toLowerCase() : "";

    const shardA =
      localStorage.getItem(`privatum_shard_a_${cleanAddr}`) ||
      localStorage.getItem(`privatum_shard_a_${targetId}`) ||
      (targetId === "primary" ? localStorage.getItem("privatum_shard_a") : null) ||
      "";

    const shardBAddress =
      localStorage.getItem(`privatum_shard_b_address_${targetId}`) ||
      (targetId === "primary" ? localStorage.getItem("privatum_shard_b_address") : null) ||
      undefined;

    const shardCAddress =
      localStorage.getItem(`privatum_shard_c_address_${targetId}`) ||
      (targetId === "primary" ? localStorage.getItem("privatum_shard_c_address") : null) ||
      undefined;

    const apiKey =
      localStorage.getItem(`privatum_api_key_${targetId}`) ||
      (targetId === "primary" ? localStorage.getItem("privatum_api_key") : null) ||
      undefined;

    const totpEnrolled =
      localStorage.getItem(`privatum_totp_enrolled_${cleanAddr}`) === "true" ||
      localStorage.getItem(`privatum_totp_enrolled_${targetId}`) === "true" ||
      (targetId === "primary" && localStorage.getItem("privatum_totp_enrolled") === "true");

    return {
      id: acc.id,
      name: acc.name || "Wallet Account",
      address: acc.address,
      shardA,
      shardBAddress,
      shardCAddress,
      apiKey,
      totpEnrolled,
    };
  });

  const contactsMap: Record<string, Contact[]> = {};
  const guardrailsMap: Record<string, SpendingGuardrailConfig> = {};
  const historyMap: Record<string, SpendingRecord[]> = {};
  const txsMap: Record<string, TransactionRecord[]> = {};

  for (const acc of accounts) {
    if (!acc.address) continue;
    const addr = acc.address.toLowerCase();

    // Contacts
    try {
      const cRaw = localStorage.getItem(`privatum_contacts_${addr}`);
      if (cRaw) contactsMap[addr] = JSON.parse(cRaw);
    } catch {}

    // Guardrails
    try {
      const gRaw = localStorage.getItem(`privatum_guardrail_config_${addr}`);
      if (gRaw) guardrailsMap[addr] = JSON.parse(gRaw);
    } catch {}

    // Spending History
    try {
      const hRaw = localStorage.getItem(`privatum_guardrail_history_${addr}`);
      if (hRaw) historyMap[addr] = JSON.parse(hRaw);
    } catch {}

    // Transactions
    try {
      const tRaw = localStorage.getItem(`privatum_transactions_${addr}`);
      if (tRaw) txsMap[addr] = JSON.parse(tRaw);
    } catch {}
  }

  return {
    format: "privatum-encrypted-vault",
    version: "1.0",
    createdAt: Date.now(),
    accounts,
    activeAccountId,
    contacts: contactsMap,
    guardrails: guardrailsMap,
    spendingHistory: historyMap,
    transactions: txsMap,
    metadata: { appVersion },
  };
}

/**
 * Computes a human-readable summary of a vault payload.
 */
export function summarizeVault(payload: VaultStatePayload): VaultSummary {
  let totalContacts = 0;
  for (const cList of Object.values(payload.contacts || {})) {
    totalContacts += Array.isArray(cList) ? cList.length : 0;
  }

  let totalTransactions = 0;
  for (const tList of Object.values(payload.transactions || {})) {
    totalTransactions += Array.isArray(tList) ? tList.length : 0;
  }

  return {
    accountCount: payload.accounts?.length || 0,
    totalContacts,
    totalTransactions,
    createdAt: payload.createdAt || Date.now(),
    appVersion: payload.metadata?.appVersion,
    accounts: (payload.accounts || []).map((a) => ({
      id: a.id,
      name: a.name,
      address: a.address,
    })),
  };
}

/**
 * Applies a restored VaultStatePayload back to local storage.
 */
export function applyRestoredVault(
  payload: VaultStatePayload,
  mode: "merge" | "overwrite" = "merge"
): { accountsRestored: number; contactsRestored: number; transactionsRestored: number } {
  if (typeof window === "undefined") {
    return { accountsRestored: 0, contactsRestored: 0, transactionsRestored: 0 };
  }

  let existingAccounts: any[] = [];
  try {
    const raw = localStorage.getItem("privatum_accounts");
    if (raw) existingAccounts = JSON.parse(raw);
  } catch {}

  const restoredAccounts = payload.accounts || [];
  let finalAccounts = restoredAccounts;

  if (mode === "merge" && existingAccounts.length > 0) {
    const existingIds = new Set(existingAccounts.map((a) => a.id));
    finalAccounts = [
      ...existingAccounts,
      ...restoredAccounts.filter((a) => !existingIds.has(a.id)),
    ];
  }

  localStorage.setItem("privatum_accounts", JSON.stringify(finalAccounts));
  if (payload.activeAccountId) {
    localStorage.setItem("privatum_active_account_id", payload.activeAccountId);
  }

  for (const acc of restoredAccounts) {
    const cleanAddr = acc.address ? acc.address.toLowerCase() : "";
    if (acc.address) {
      localStorage.setItem(`privatum_wallet_address_${acc.id}`, acc.address);
      if (acc.id === "primary") {
        localStorage.setItem("privatum_wallet_address", acc.address);
      }
    }
    if (acc.shardA) {
      localStorage.setItem(`privatum_shard_a_${acc.id}`, acc.shardA);
      if (cleanAddr) {
        localStorage.setItem(`privatum_shard_a_${cleanAddr}`, acc.shardA);
      }
      if (acc.id === "primary") {
        localStorage.setItem("privatum_shard_a", acc.shardA);
      }
    }
    if (acc.shardBAddress) {
      localStorage.setItem(`privatum_shard_b_address_${acc.id}`, acc.shardBAddress);
      if (acc.id === "primary") {
        localStorage.setItem("privatum_shard_b_address", acc.shardBAddress);
      }
    }
    if (acc.shardCAddress) {
      localStorage.setItem(`privatum_shard_c_address_${acc.id}`, acc.shardCAddress);
      if (acc.id === "primary") {
        localStorage.setItem("privatum_shard_c_address", acc.shardCAddress);
      }
    }
    if (acc.apiKey) {
      localStorage.setItem(`privatum_api_key_${acc.id}`, acc.apiKey);
      if (acc.id === "primary") {
        localStorage.setItem("privatum_api_key", acc.apiKey);
      }
    }
    if (acc.totpEnrolled) {
      localStorage.setItem(`privatum_totp_enrolled_${acc.id}`, "true");
      if (cleanAddr) {
        localStorage.setItem(`privatum_totp_enrolled_${cleanAddr}`, "true");
      }
      if (acc.id === "primary") {
        localStorage.setItem("privatum_totp_enrolled", "true");
      }
    }
  }

  let totalContacts = 0;
  for (const [addr, contacts] of Object.entries(payload.contacts || {})) {
    if (!Array.isArray(contacts)) continue;
    const key = `privatum_contacts_${addr.toLowerCase()}`;
    if (mode === "merge") {
      let current: Contact[] = [];
      try {
        const raw = localStorage.getItem(key);
        if (raw) current = JSON.parse(raw);
      } catch {}
      const existingAddresses = new Set(current.map((c) => c.address.toLowerCase()));
      const merged = [...current, ...contacts.filter((c) => !existingAddresses.has(c.address.toLowerCase()))];
      localStorage.setItem(key, JSON.stringify(merged));
      totalContacts += merged.length;
    } else {
      localStorage.setItem(key, JSON.stringify(contacts));
      totalContacts += contacts.length;
    }
  }

  for (const [addr, cfg] of Object.entries(payload.guardrails || {})) {
    const key = `privatum_guardrail_config_${addr.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(cfg));
  }

  for (const [addr, history] of Object.entries(payload.spendingHistory || {})) {
    const key = `privatum_guardrail_history_${addr.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(history));
  }

  let totalTxs = 0;
  for (const [addr, txs] of Object.entries(payload.transactions || {})) {
    if (!Array.isArray(txs)) continue;
    const key = `privatum_transactions_${addr.toLowerCase()}`;
    if (mode === "merge") {
      let current: TransactionRecord[] = [];
      try {
        const raw = localStorage.getItem(key);
        if (raw) current = JSON.parse(raw);
      } catch {}
      const existingIds = new Set(current.map((t) => t.id));
      const merged = [...current, ...txs.filter((t) => !existingIds.has(t.id))];
      localStorage.setItem(key, JSON.stringify(merged));
      totalTxs += merged.length;
    } else {
      localStorage.setItem(key, JSON.stringify(txs));
      totalTxs += txs.length;
    }
  }

  return {
    accountsRestored: restoredAccounts.length,
    contactsRestored: totalContacts,
    transactionsRestored: totalTxs,
  };
}

/**
 * Triggers browser download of an encrypted vault container file.
 */
export function downloadVaultFile(containerBytes: Uint8Array, date = new Date()): void {
  if (typeof window === "undefined") return;
  const dateStr = date.toISOString().slice(0, 10);
  const filename = `privatum-vault-backup-${dateStr}.privvault`;

  const blob = new Blob([containerBytes as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
