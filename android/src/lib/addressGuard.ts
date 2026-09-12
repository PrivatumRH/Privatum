/**
 * Mobile Address Poisoning Shield.
 *
 * Compares pending recipients against historical counterparties and own accounts.
 * Flags look-alike impersonator addresses before Shard A signs.
 */

export type AddressGuardLevel = "ok" | "known" | "warning" | "danger";

export interface AddressGuardVerdict {
  level: AddressGuardLevel;
  title: string;
  detail: string;
  lookalikeOf?: string;
  prefixMatch?: number;
  suffixMatch?: number;
}

export interface AddressGuardHistoryEntry {
  type: "send" | "receive";
  counterparty: string;
  amount: string;
  asset: string;
}

export interface AddressGuardInput {
  recipient: string;
  history: AddressGuardHistoryEntry[];
  ownAddresses: string[];
}

const BOTH_ENDS_THRESHOLD = 4;
const SINGLE_END_THRESHOLD = 6;
const DUST_AMOUNT = 0.001;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isPlainAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

function body(address: string): string {
  return address.trim().toLowerCase().replace(/^0x/, "");
}

export function commonPrefixLength(a: string, b: string): number {
  const ba = body(a);
  const bb = body(b);
  const len = Math.min(ba.length, bb.length);
  let i = 0;
  while (i < len && ba[i] === bb[i]) i++;
  return i;
}

export function commonSuffixLength(a: string, b: string): number {
  const ba = body(a);
  const bb = body(b);
  const len = Math.min(ba.length, bb.length);
  let i = 0;
  while (i < len && ba[ba.length - 1 - i] === bb[bb.length - 1 - i]) i++;
  return i;
}

function trustedFromHistory(history: AddressGuardHistoryEntry[]): string[] {
  const out = new Set<string>();
  for (const entry of history) {
    if (entry.type !== "send") continue;
    if (!isPlainAddress(entry.counterparty)) continue;
    out.add(entry.counterparty.trim().toLowerCase());
  }
  return [...out];
}

function dustOnlyContacts(history: AddressGuardHistoryEntry[]): Set<string> {
  const received = new Map<string, boolean>();
  const sentTo = new Set<string>();

  for (const entry of history) {
    if (!isPlainAddress(entry.counterparty)) continue;
    const clean = entry.counterparty.trim().toLowerCase();
    if (entry.type === "send") {
      sentTo.add(clean);
    } else {
      const amt = parseFloat(entry.amount);
      const isDust = Number.isFinite(amt) && amt <= DUST_AMOUNT;
      const prior = received.get(clean);
      received.set(clean, prior === false ? false : isDust);
    }
  }

  const dustSet = new Set<string>();
  for (const [addr, onlyDust] of received.entries()) {
    if (onlyDust && !sentTo.has(addr)) {
      dustSet.add(addr);
    }
  }
  return dustSet;
}

export function checkAddressPoisoning(input: AddressGuardInput): AddressGuardVerdict {
  const rawRecipient = (input.recipient || "").trim();

  if (!rawRecipient) {
    return {
      level: "ok",
      title: "Recipient Required",
      detail: "Enter an address to check poisoning indicators.",
    };
  }

  if (rawRecipient.toLowerCase().startsWith("st:")) {
    return {
      level: "ok",
      title: "Stealth Meta-Address",
      detail: "Stealth address derivation produces fresh one-time addresses automatically.",
    };
  }

  if (!isPlainAddress(rawRecipient)) {
    return {
      level: "ok",
      title: "Standard Address",
      detail: "Proceed with normal address validation.",
    };
  }

  const cleanRecipient = rawRecipient.toLowerCase();

  for (const own of input.ownAddresses || []) {
    if (own && own.trim().toLowerCase() === cleanRecipient) {
      return {
        level: "known",
        title: "Own Account",
        detail: "This recipient is one of your own verified accounts.",
      };
    }
  }

  const trusted = trustedFromHistory(input.history || []);
  for (const t of trusted) {
    if (t === cleanRecipient) {
      return {
        level: "known",
        title: "Verified Recipient",
        detail: "You have previously sent funds to this address.",
      };
    }
  }

  const dust = dustOnlyContacts(input.history || []);
  if (dust.has(cleanRecipient)) {
    return {
      level: "danger",
      title: "Suspicious Dust Sender",
      detail: "This address has only ever sent you dust. It may be an address poisoning attempt.",
    };
  }

  const candidates = new Set<string>([...trusted, ...(input.ownAddresses || []).map((a) => a.trim().toLowerCase())]);

  let bestMatch: { target: string; prefix: number; suffix: number; level: AddressGuardLevel } | null = null;

  for (const candidate of candidates) {
    if (!isPlainAddress(candidate) || candidate === cleanRecipient) continue;

    const prefix = commonPrefixLength(cleanRecipient, candidate);
    const suffix = commonSuffixLength(cleanRecipient, candidate);

    if (prefix >= BOTH_ENDS_THRESHOLD && suffix >= BOTH_ENDS_THRESHOLD) {
      bestMatch = { target: candidate, prefix, suffix, level: "danger" };
      break;
    }

    if (prefix >= SINGLE_END_THRESHOLD || suffix >= SINGLE_END_THRESHOLD) {
      if (!bestMatch || bestMatch.level !== "danger") {
        bestMatch = { target: candidate, prefix, suffix, level: "warning" };
      }
    }
  }

  if (bestMatch) {
    const isDanger = bestMatch.level === "danger";
    return {
      level: bestMatch.level,
      title: isDanger ? "Potential Poisoned Address" : "Look-Alike Warning",
      detail: `This address shares ${bestMatch.prefix} prefix and ${bestMatch.suffix} suffix characters with a trusted contact (${bestMatch.target.slice(0, 6)}...${bestMatch.target.slice(-4)}).`,
      lookalikeOf: bestMatch.target,
      prefixMatch: bestMatch.prefix,
      suffixMatch: bestMatch.suffix,
    };
  }

  return {
    level: "ok",
    title: "New Recipient",
    detail: "First time sending to this address. No look-alike collisions detected.",
  };
}
