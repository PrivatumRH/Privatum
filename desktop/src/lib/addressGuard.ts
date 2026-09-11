/**
 * Address poisoning guard.
 *
 * Attackers send a dust transfer from an address engineered to share the first
 * and last few hex characters of an address the victim already trusts. The
 * victim later copies the look-alike out of a truncated history row ("0x1234
 * ...abcd" renders identically for both) and sends real funds to the attacker.
 *
 * This module compares a pending recipient against the addresses the wallet has
 * deliberately paid before, plus the user's own accounts, and reports a verdict
 * the send flow can surface before Shard A ever signs.
 */

export type AddressGuardLevel = "ok" | "known" | "warning" | "danger";

export interface AddressGuardVerdict {
  level: AddressGuardLevel;
  title: string;
  detail: string;
  /** The trusted address the recipient impersonates, when level is warning/danger. */
  lookalikeOf?: string;
  /** Characters matched at each end, for rendering the comparison. */
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
  /** Local transaction history for the active wallet. */
  history: AddressGuardHistoryEntry[];
  /** Every address this user controls, so self-sends read as trusted. */
  ownAddresses: string[];
}

/** Both ends matching this many hex chars is the signature of a poisoned address. */
const BOTH_ENDS_THRESHOLD = 4;
/** One end matching this many chars is vanishingly unlikely by chance. */
const SINGLE_END_THRESHOLD = 6;
/** Incoming transfers at or below this are treated as poisoning dust. */
const DUST_AMOUNT = 0.001;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isPlainAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

/** Hex body of an address, lowercased, without the 0x prefix. */
function body(address: string): string {
  return address.trim().toLowerCase().replace(/^0x/, "");
}

export function commonPrefixLength(a: string, b: string): number {
  const x = body(a);
  const y = body(b);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

export function commonSuffixLength(a: string, b: string): number {
  const x = body(a);
  const y = body(b);
  let i = 0;
  while (i < x.length && i < y.length && x[x.length - 1 - i] === y[y.length - 1 - i]) i++;
  return i;
}

/**
 * Addresses the user has deliberately paid. Receiving from an address proves
 * nothing — the attacker chooses that — so only outgoing transfers count.
 */
function trustedFromHistory(history: AddressGuardHistoryEntry[]): string[] {
  const out = new Set<string>();
  for (const entry of history) {
    if (entry.type !== "send") continue;
    // Stealth sends are recorded as "(Stealth) 0x1234...abcd", not a full address.
    if (!isPlainAddress(entry.counterparty)) continue;
    out.add(entry.counterparty.trim().toLowerCase());
  }
  return [...out];
}

/**
 * Addresses that only ever appeared as a tiny incoming transfer. Nothing the
 * user did put them in the history — the sender did.
 */
function dustOnlyContacts(history: AddressGuardHistoryEntry[]): Set<string> {
  const received = new Map<string, boolean>();
  const sentTo = new Set<string>();

  for (const entry of history) {
    if (!isPlainAddress(entry.counterparty)) continue;
    const addr = entry.counterparty.trim().toLowerCase();
    if (entry.type === "send") {
      sentTo.add(addr);
      continue;
    }
    const amount = parseFloat(entry.amount);
    const isDust = !isNaN(amount) && amount <= DUST_AMOUNT;
    // Any non-dust receive clears the address.
    received.set(addr, (received.get(addr) ?? true) && isDust);
  }

  const out = new Set<string>();
  for (const [addr, onlyDust] of received) {
    if (onlyDust && !sentTo.has(addr)) out.add(addr);
  }
  return out;
}

export function checkAddressPoisoning({
  recipient,
  history,
  ownAddresses,
}: AddressGuardInput): AddressGuardVerdict {
  const target = recipient.trim().toLowerCase();

  if (!isPlainAddress(target)) {
    return { level: "ok", title: "", detail: "" };
  }

  const own = new Set(ownAddresses.filter(isPlainAddress).map((a) => a.trim().toLowerCase()));
  if (own.has(target)) {
    return {
      level: "known",
      title: "Your own wallet",
      detail: "This address is one of your PRIVATUM accounts.",
    };
  }

  const trusted = trustedFromHistory(history);
  if (trusted.includes(target)) {
    return {
      level: "known",
      title: "Paid before",
      detail: "You have sent to this exact address previously.",
    };
  }

  if (dustOnlyContacts(history).has(target)) {
    return {
      level: "danger",
      title: "Address arrived as dust",
      detail:
        "This address only ever sent you a tiny transfer and you have never paid it. " +
        "That is how poisoned addresses get into a history. Verify it from your own records before sending.",
    };
  }

  // Compare against every trusted address and report the closest impersonation.
  const candidates = [...own, ...trusted];
  let closest: AddressGuardVerdict | null = null;
  let bestScore = -1;

  for (const known of candidates) {
    if (known === target) continue;
    const prefix = commonPrefixLength(target, known);
    const suffix = commonSuffixLength(target, known);

    const bothEnds = prefix >= BOTH_ENDS_THRESHOLD && suffix >= BOTH_ENDS_THRESHOLD;
    const singleEnd = prefix >= SINGLE_END_THRESHOLD || suffix >= SINGLE_END_THRESHOLD;
    if (!bothEnds && !singleEnd) continue;

    const score = prefix + suffix;
    if (score <= bestScore) continue;
    bestScore = score;

    closest = bothEnds
      ? {
          level: "danger",
          title: "Look-alike address",
          detail:
            `This address copies the first ${prefix} and last ${suffix} characters of an address you have ` +
            "used before, but the middle is different. This is the signature of an address poisoning attack. " +
            "Check every character against your own records.",
          lookalikeOf: known,
          prefixMatch: prefix,
          suffixMatch: suffix,
        }
      : {
          level: "warning",
          title: "Resembles a known address",
          detail:
            `This address shares ${Math.max(prefix, suffix)} characters at one end with an address you have ` +
            "used before. Confirm the full address before sending.",
          lookalikeOf: known,
          prefixMatch: prefix,
          suffixMatch: suffix,
        };
  }

  if (closest) return closest;

  return {
    level: "ok",
    title: "New address",
    detail: "You have not sent to this address before.",
  };
}

/** Whether the send flow must collect an explicit acknowledgment. */
export function requiresAcknowledgement(verdict: AddressGuardVerdict): boolean {
  return verdict.level === "danger" || verdict.level === "warning";
}
