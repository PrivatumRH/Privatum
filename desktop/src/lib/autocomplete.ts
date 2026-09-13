/**
 * Recipient Contact & Counterparty Autocomplete Engine for PRIVATUM Desktop.
 *
 * Provides real-time, deterministic candidate matching across:
 * 1. Saved Private Address Book contacts.
 * 2. Unsaved historical counterparties extracted from confirmed transaction logs.
 *
 * 100% client-side: operates exclusively in memory over local state with zero network queries.
 */

import { Contact, ContactCategory } from "./contacts";
import { checkAddressPoisoning, AddressGuardHistoryEntry } from "./addressGuard";

export interface TransactionSummaryLike {
  counterparty: string;
  timestamp: number;
  type?: "send" | "receive";
  status?: string;
}

export interface AutocompleteCandidate {
  address: string;
  name: string;
  isSavedContact: boolean;
  isStarred?: boolean;
  contactId?: string;
  category?: ContactCategory;
  note?: string;
  lastUsedAt?: number;
  transactionCount: number;
  isPoisonRisk?: boolean;
  poisonTargetName?: string;
  score: number;
}

export interface GetAutocompleteCandidatesParams {
  query: string;
  contacts: Contact[];
  transactions?: TransactionSummaryLike[];
  ownAddress?: string;
  addressHistory?: AddressGuardHistoryEntry[];
  limit?: number;
}

/**
 * Formats an address cleanly for display (e.g. 0x1234...5678 or st:eth:0x...).
 */
export function formatAddressTruncated(address: string, lead = 6, tail = 4): string {
  if (!address) return "";
  const clean = address.trim();
  if (clean.length <= lead + tail + 3) return clean;
  return `${clean.slice(0, lead)}...${clean.slice(-tail)}`;
}

/**
 * Computes a relevance score between a query string and candidate attributes.
 * Higher score indicates a stronger match.
 */
function computeScore(
  cleanQuery: string,
  name: string,
  address: string,
  category?: string,
  note?: string,
  lastUsedAt?: number,
  txCount = 0,
  isSavedContact = false,
  isStarred = false
): number {
  if (!cleanQuery) {
    // Empty query: score by saved status, starred status, recency and transaction volume
    let base = isSavedContact ? 35 : 10;
    if (isStarred) {
      base += 40;
    }
    if (lastUsedAt && lastUsedAt > 0) {
      const daysOld = (Date.now() - lastUsedAt) / (1000 * 60 * 60 * 24);
      if (daysOld <= 1) base += 50;
      else if (daysOld <= 7) base += 35;
      else if (daysOld <= 30) base += 20;
      else base += 10;
    }
    base += Math.min(txCount * 2, 20);
    return base;
  }

  let score = 0;
  const nameLower = name.toLowerCase();
  const addressLower = address.toLowerCase();
  const categoryLower = (category || "").toLowerCase();
  const noteLower = (note || "").toLowerCase();

  // 1. Name matches
  if (nameLower === cleanQuery) {
    score += 120;
  } else if (nameLower.startsWith(cleanQuery)) {
    score += 90;
  } else if (nameLower.includes(cleanQuery)) {
    score += 65;
  }

  // 2. Address matches (prefix, suffix, or body)
  const queryWithout0x = cleanQuery.replace(/^0x/, "");
  const addressWithout0x = addressLower.replace(/^0x/, "");

  if (addressLower === cleanQuery) {
    score += 110;
  } else if (addressLower.startsWith(cleanQuery) || addressWithout0x.startsWith(queryWithout0x)) {
    score += 85;
  } else if (addressLower.endsWith(cleanQuery) || addressWithout0x.endsWith(queryWithout0x)) {
    score += 70;
  } else if (addressLower.includes(cleanQuery) || addressWithout0x.includes(queryWithout0x)) {
    score += 45;
  }

  // 3. Category match
  if (categoryLower.startsWith(cleanQuery)) {
    score += 40;
  }

  // 4. Note match
  if (noteLower.includes(cleanQuery)) {
    score += 30;
  }

  // If there was any textual match, apply recency and frequency bonuses
  if (score > 0) {
    if (isStarred) {
      score += 30;
    }
    if (lastUsedAt && lastUsedAt > 0) {
      const daysOld = (Date.now() - lastUsedAt) / (1000 * 60 * 60 * 24);
      if (daysOld <= 7) score += 15;
      else if (daysOld <= 30) score += 10;
      else score += 5;
    }
    score += Math.min(txCount, 10);
  }

  return score;
}

/**
 * Generates ranked autocomplete candidates from saved contacts and transaction history.
 */
export function getAutocompleteCandidates(
  params: GetAutocompleteCandidatesParams
): AutocompleteCandidate[] {
  const {
    query,
    contacts,
    transactions = [],
    ownAddress,
    addressHistory = [],
    limit = 5,
  } = params;

  const cleanQuery = query.trim().toLowerCase();
  const ownClean = (ownAddress || "").trim().toLowerCase();

  // Aggregate transaction counts and latest timestamps per counterparty address
  const txStatsByAddress = new Map<string, { count: number; lastTimestamp: number }>();

  for (const tx of transactions) {
    const cp = (tx.counterparty || "").trim().toLowerCase();
    if (!cp || (ownClean && cp === ownClean)) continue;

    const existing = txStatsByAddress.get(cp);
    if (existing) {
      existing.count += 1;
      if (tx.timestamp > existing.lastTimestamp) {
        existing.lastTimestamp = tx.timestamp;
      }
    } else {
      txStatsByAddress.set(cp, {
        count: 1,
        lastTimestamp: tx.timestamp || 0,
      });
    }
  }

  // Collect candidate addresses mapped to their rich representation
  const candidatesMap = new Map<string, AutocompleteCandidate>();

  // Process Saved Contacts first
  for (const c of contacts) {
    const addrClean = (c.address || "").trim().toLowerCase();
    if (!addrClean || (ownClean && addrClean === ownClean)) continue;

    const stats = txStatsByAddress.get(addrClean);
    const txCount = stats ? stats.count : 0;
    const effectiveLastUsed = c.lastUsedAt || (stats ? stats.lastTimestamp : undefined);
    const isStarred = Boolean(c.isStarred);

    const score = computeScore(
      cleanQuery,
      c.name,
      c.address,
      c.category,
      c.note,
      effectiveLastUsed,
      txCount,
      true,
      isStarred
    );

    // If query is present, only include items with a positive score
    if (cleanQuery && score <= 0) continue;

    candidatesMap.set(addrClean, {
      address: c.address.trim(),
      name: c.name.trim(),
      isSavedContact: true,
      isStarred,
      contactId: c.id,
      category: c.category,
      note: c.note,
      lastUsedAt: effectiveLastUsed,
      transactionCount: txCount,
      score,
    });
  }

  // Process Unsaved Transaction Counterparties
  for (const [addrClean, stats] of txStatsByAddress.entries()) {
    if (candidatesMap.has(addrClean)) continue;

    // Use original casing if available from transaction list
    const sampleTx = transactions.find(
      (t) => (t.counterparty || "").trim().toLowerCase() === addrClean
    );
    const displayAddress = sampleTx?.counterparty ? sampleTx.counterparty.trim() : addrClean;

    const defaultName = "Recent Counterparty";
    const score = computeScore(
      cleanQuery,
      defaultName,
      displayAddress,
      undefined,
      undefined,
      stats.lastTimestamp,
      stats.count,
      false
    );

    // If query is present, only include items with a positive score
    if (cleanQuery && score <= 0) continue;

    candidatesMap.set(addrClean, {
      address: displayAddress,
      name: defaultName,
      isSavedContact: false,
      lastUsedAt: stats.lastTimestamp,
      transactionCount: stats.count,
      score,
    });
  }

  // Convert to array and evaluate look-alike poisoning risks if address history provided
  const candidates = Array.from(candidatesMap.values());

  for (const cand of candidates) {
    if (addressHistory.length > 0) {
      const verdict = checkAddressPoisoning({
        recipient: cand.address,
        history: addressHistory,
        ownAddresses: ownAddress ? [ownAddress] : [],
      });
      if (verdict.level === "danger" || verdict.level === "warning") {
        cand.isPoisonRisk = true;
        if (verdict.lookalikeOf) {
          cand.poisonTargetName = formatAddressTruncated(verdict.lookalikeOf);
        }
      }
    }
  }

  // Sort descending by score, then recency, then transaction count
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.lastUsedAt || 0;
    const bTime = b.lastUsedAt || 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.transactionCount - a.transactionCount;
  });

  return candidates.slice(0, limit);
}
