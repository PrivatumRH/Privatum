/**
 * Transfer Blacklist & Threat Intelligence Guard (v0.1.33)
 * Deterministic counterparty blocklist system with curated threat feeds
 * and client-side custom address management.
 */

export type BlacklistCategory =
  | "Phishing"
  | "Malicious"
  | "Sanctioned"
  | "Compromised"
  | "Custom";

export interface BlacklistEntry {
  address: string; // 0x lowercase 40-hex address
  name?: string;
  reason: string;
  category: BlacklistCategory;
  addedAt: number;
  source: "curated" | "user";
}

export interface BlacklistVerdict {
  isBlacklisted: boolean;
  entry?: BlacklistEntry;
}

const STORAGE_KEY = "privatum_transfer_blacklist";

/**
 * Curated Threat Intelligence Feed
 * High-severity phishing drainers, known exploit addresses, and malicious smart contracts.
 */
export const CURATED_THREAT_FEED: BlacklistEntry[] = [
  {
    address: "0x0000000000000000000000000000000000000000",
    name: "Zero Address / Burn",
    reason: "Null burn destination. Prevent accidental loss of funds.",
    category: "Malicious",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x000000000000000000000000000000000000dead",
    name: "Dead Address / Burn Sink",
    reason: "Irrecoverable dead burn sink.",
    category: "Malicious",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
    name: "Tornado Cash Router",
    reason: "OFAC sanctioned mixer smart contract.",
    category: "Sanctioned",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    name: "Tornado Cash 0.1 ETH",
    reason: "OFAC sanctioned mixer pool address.",
    category: "Sanctioned",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x72a5843cc08275c80f0358f12cb66353c44b8272",
    name: "Tornado Cash 1 ETH",
    reason: "OFAC sanctioned mixer pool address.",
    category: "Sanctioned",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
    name: "Tornado Cash 10 ETH",
    reason: "OFAC sanctioned mixer pool address.",
    category: "Sanctioned",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    name: "Tornado Cash 100 ETH",
    reason: "OFAC sanctioned mixer pool address.",
    category: "Sanctioned",
    addedAt: 1700000000000,
    source: "curated",
  },
  {
    address: "0x0000490b8f4ebf2ffdc1fb66bc2f210515aa0000",
    name: "Pink Drainer Sweeper",
    reason: "Known malicious phishing drainer collection contract.",
    category: "Phishing",
    addedAt: 1705000000000,
    source: "curated",
  },
  {
    address: "0x00000808b04a9d821ae54a3be0876ce8b7ff0000",
    name: "Inferno Drainer Proxy",
    reason: "Phishing drainer targeting Permit2 and ERC20 approvals.",
    category: "Phishing",
    addedAt: 1705000000000,
    source: "curated",
  },
  {
    address: "0x111111125434b317722f7b31a4f9435b6b660000",
    name: "Fake DEX Spoof",
    reason: "Lookalike phishing contract spoofing 1inch router.",
    category: "Phishing",
    addedAt: 1706000000000,
    source: "curated",
  },
  {
    address: "0x000000000018593d6cd6a73c38efc63c78cd0000",
    name: "Angel Drainer Sweep",
    reason: "Exploit drainer associated with malicious wallet drain scripts.",
    category: "Phishing",
    addedAt: 1707000000000,
    source: "curated",
  },
  {
    address: "0x0000000000705a610f7aa084ae0cfb4393430000",
    name: "Monkey Drainer Primary",
    reason: "Historical high-volume NFT and token drainer.",
    category: "Phishing",
    addedAt: 1708000000000,
    source: "curated",
  },
  {
    address: "0xb3764761e297d6f121e79c3e4e8580cfa959a4c5",
    name: "Euler Finance Exploiter",
    reason: "Known flash loan exploit receiver address.",
    category: "Compromised",
    addedAt: 1709000000000,
    source: "curated",
  },
  {
    address: "0x098b716b8aaf21512996dc57eb0615e2383e2f96",
    name: "Ronin Bridge Exploiter",
    reason: "Lazarus Group associated bridge exploit wallet.",
    category: "Sanctioned",
    addedAt: 1710000000000,
    source: "curated",
  },
  {
    address: "0xc854bf992127ae35a537f433933c8859d55acb70",
    name: "Multichain Exploiter",
    reason: "Compromised MPC multi-party bridge signer address.",
    category: "Compromised",
    addedAt: 1711000000000,
    source: "curated",
  },
];

/**
 * Normalizes an Ethereum-compatible address to lowercase 0x format.
 */
export function normalizeAddress(address: string): string {
  if (!address) return "";
  return address.trim().toLowerCase();
}

/**
 * Validates whether a string is a well-formed 0x Ethereum address (40 hex chars).
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  const normalized = normalizeAddress(address);
  return /^0x[0-9a-f]{40}$/.test(normalized);
}

/**
 * Loads custom user-defined blacklist entries from localStorage.
 */
export function loadCustomBlacklist(): BlacklistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item.address === "string" && isValidAddress(item.address))
        .map((item) => ({
          address: normalizeAddress(item.address),
          name: typeof item.name === "string" ? item.name.trim() : undefined,
          reason: typeof item.reason === "string" ? item.reason.trim() : "User specified blacklist entry",
          category: (item.category || "Custom") as BlacklistCategory,
          addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
          source: "user" as const,
        }));
    }
  } catch (err) {
    console.warn("Failed to load transfer blacklist from localStorage:", err);
  }
  return [];
}

/**
 * Persists custom user-defined blacklist entries to localStorage.
 */
export function saveCustomBlacklist(entries: BlacklistEntry[]): void {
  try {
    const userOnly = entries
      .filter((e) => e.source === "user")
      .map((e) => ({
        address: normalizeAddress(e.address),
        name: e.name,
        reason: e.reason,
        category: e.category,
        addedAt: e.addedAt,
        source: "user" as const,
      }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
  } catch (err) {
    console.warn("Failed to save transfer blacklist to localStorage:", err);
  }
}

/**
 * Returns the immutable curated threat feed.
 */
export function getCuratedThreatFeed(): BlacklistEntry[] {
  return [...CURATED_THREAT_FEED];
}

/**
 * Returns all active blacklist entries, combining curated threat feeds
 * and custom user entries. User entries take precedence if address overlaps.
 */
export function getAllBlacklistEntries(customList?: BlacklistEntry[]): BlacklistEntry[] {
  const userEntries = customList || loadCustomBlacklist();
  const map = new Map<string, BlacklistEntry>();

  // Load curated first
  for (const item of CURATED_THREAT_FEED) {
    map.set(normalizeAddress(item.address), item);
  }

  // User entries override or augment
  for (const item of userEntries) {
    map.set(normalizeAddress(item.address), item);
  }

  return Array.from(map.values()).sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Checks if a specific address is blacklisted in either curated feed or custom entries.
 */
export function checkAddressBlacklist(
  address: string,
  customList?: BlacklistEntry[]
): BlacklistVerdict | null {
  if (!address) return null;
  const normalized = normalizeAddress(address);
  if (!isValidAddress(normalized)) return null;

  const allEntries = getAllBlacklistEntries(customList);
  const found = allEntries.find((e) => normalizeAddress(e.address) === normalized);

  if (found) {
    return {
      isBlacklisted: true,
      entry: found,
    };
  }

  return null;
}

/**
 * Boolean check for address blacklist presence.
 */
export function isAddressBlacklisted(
  address: string,
  customList?: BlacklistEntry[]
): boolean {
  const verdict = checkAddressBlacklist(address, customList);
  return Boolean(verdict && verdict.isBlacklisted);
}

/**
 * Adds a new address to the user's custom blacklist.
 */
export function addCustomBlacklistEntry(entry: {
  address: string;
  name?: string;
  reason: string;
  category?: BlacklistCategory;
}): { success: boolean; error?: string; entries: BlacklistEntry[] } {
  const normalized = normalizeAddress(entry.address);

  if (!isValidAddress(normalized)) {
    return {
      success: false,
      error: "Invalid Ethereum address format. Must be 0x followed by 40 hexadecimal characters.",
      entries: loadCustomBlacklist(),
    };
  }

  const current = loadCustomBlacklist();
  const existingIdx = current.findIndex((e) => normalizeAddress(e.address) === normalized);

  const newEntry: BlacklistEntry = {
    address: normalized,
    name: entry.name?.trim() || undefined,
    reason: entry.reason?.trim() || "Blocked by user",
    category: entry.category || "Custom",
    addedAt: Date.now(),
    source: "user",
  };

  let updated: BlacklistEntry[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = newEntry;
  } else {
    updated = [newEntry, ...current];
  }

  saveCustomBlacklist(updated);
  return {
    success: true,
    entries: updated,
  };
}

/**
 * Removes an address from the user's custom blacklist.
 * Note: Curated threat feed entries cannot be removed.
 */
export function removeCustomBlacklistEntry(address: string): BlacklistEntry[] {
  const normalized = normalizeAddress(address);
  const current = loadCustomBlacklist();
  const filtered = current.filter((e) => normalizeAddress(e.address) !== normalized);
  saveCustomBlacklist(filtered);
  return filtered;
}

/**
 * Exports custom user blacklist entries as a formatted JSON string.
 */
export function exportBlacklistJson(): string {
  const userEntries = loadCustomBlacklist();
  const payload = {
    app: "Privatum",
    version: "0.1.33",
    exportedAt: new Date().toISOString(),
    entries: userEntries,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports custom blacklist entries from a JSON string.
 */
export function importBlacklistJson(
  jsonStr: string
): { success: boolean; addedCount: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    const rawList = Array.isArray(data) ? data : data.entries;

    if (!Array.isArray(rawList)) {
      return { success: false, addedCount: 0, error: "Invalid JSON: expected an array of blacklist entries." };
    }

    const current = loadCustomBlacklist();
    const map = new Map<string, BlacklistEntry>();

    for (const item of current) {
      map.set(normalizeAddress(item.address), item);
    }

    let addedCount = 0;
    for (const item of rawList) {
      if (!item || typeof item.address !== "string") continue;
      const normalized = normalizeAddress(item.address);
      if (!isValidAddress(normalized)) continue;

      map.set(normalized, {
        address: normalized,
        name: typeof item.name === "string" ? item.name.trim() : undefined,
        reason: typeof item.reason === "string" ? item.reason.trim() : "Imported blacklist entry",
        category: (item.category || "Custom") as BlacklistCategory,
        addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
        source: "user",
      });
      addedCount++;
    }

    const updated = Array.from(map.values());
    saveCustomBlacklist(updated);
    return { success: true, addedCount };
  } catch (err: any) {
    return { success: false, addedCount: 0, error: err?.message || "Failed to parse JSON file." };
  }
}
