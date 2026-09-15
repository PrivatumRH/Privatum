export interface WhitelistEntry {
  address: string;
  label: string;
  note?: string;
  addedAt: number;
}

export interface WhitelistConfig {
  strictMode: boolean;
}

const ENTRIES_KEY = "privatum_transfer_whitelist";
const CONFIG_KEY = "privatum_transfer_whitelist_config";

export function normalizeWhitelistAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function isValidWhitelistAddress(address: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(normalizeWhitelistAddress(address));
}

export function loadWhitelist(): WhitelistEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ENTRIES_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && isValidWhitelistAddress(entry.address))
      .map((entry) => ({
        address: normalizeWhitelistAddress(entry.address),
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "Approved counterparty",
        note: typeof entry.note === "string" ? entry.note.trim() || undefined : undefined,
        addedAt: typeof entry.addedAt === "number" ? entry.addedAt : Date.now(),
      }))
      .sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

export function saveWhitelist(entries: WhitelistEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function loadWhitelistConfig(): WhitelistConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return { strictMode: Boolean(parsed.strictMode) };
  } catch {
    return { strictMode: false };
  }
}

export function saveWhitelistConfig(config: WhitelistConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ strictMode: config.strictMode }));
}

export function isWhitelisted(address: string, entries: WhitelistEntry[] = loadWhitelist()): boolean {
  const normalized = normalizeWhitelistAddress(address);
  return isValidWhitelistAddress(normalized) && entries.some((entry) => entry.address === normalized);
}

export function addWhitelistEntry(input: { address: string; label: string; note?: string }): WhitelistEntry[] {
  const address = normalizeWhitelistAddress(input.address);
  if (!isValidWhitelistAddress(address)) throw new Error("Enter a valid 0x Ethereum address.");
  if (!input.label.trim()) throw new Error("A counterparty label is required.");
  const entry: WhitelistEntry = { address, label: input.label.trim(), note: input.note?.trim() || undefined, addedAt: Date.now() };
  const entries = loadWhitelist().filter((item) => item.address !== address);
  const updated = [entry, ...entries];
  saveWhitelist(updated);
  return updated;
}

export function removeWhitelistEntry(address: string): WhitelistEntry[] {
  const updated = loadWhitelist().filter((entry) => entry.address !== normalizeWhitelistAddress(address));
  saveWhitelist(updated);
  return updated;
}

export function exportWhitelistJson(): string {
  return JSON.stringify({ app: "Privatum", version: "0.1.34", exportedAt: new Date().toISOString(), entries: loadWhitelist() }, null, 2);
}

export function importWhitelistJson(raw: string): WhitelistEntry[] {
  const parsed = JSON.parse(raw);
  const candidates = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(candidates)) throw new Error("Expected a whitelist entries array.");
  const existing = new Map(loadWhitelist().map((entry) => [entry.address, entry]));
  for (const candidate of candidates) {
    if (!candidate || !isValidWhitelistAddress(candidate.address)) continue;
    const address = normalizeWhitelistAddress(candidate.address);
    existing.set(address, {
      address,
      label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : "Imported counterparty",
      note: typeof candidate.note === "string" ? candidate.note.trim() || undefined : undefined,
      addedAt: typeof candidate.addedAt === "number" ? candidate.addedAt : Date.now(),
    });
  }
  const updated = Array.from(existing.values()).sort((a, b) => b.addedAt - a.addedAt);
  saveWhitelist(updated);
  return updated;
}
