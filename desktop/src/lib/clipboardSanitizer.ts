/**
 * Clipboard Hijack & Lookalike Address Sanitizer
 *
 * Detects clipper malware tampering, invisible unicode characters,
 * and lookalike address poisoning against user contacts and approved whitelist entries.
 */

export interface CopiedAddressRecord {
  address: string;
  label?: string;
  copiedAt: number;
}

export interface KnownReference {
  address: string;
  label: string;
  source: "contact" | "whitelist" | "account" | "history";
  isStarred?: boolean;
}

export type SanitizerIssueType =
  | "clipper_tamper"
  | "clipboard_mismatch"
  | "lookalike_poison"
  | "invisible_unicode"
  | "none";

export type SanitizerSeverity = "danger" | "warning" | "info" | "clean";

export interface AddressDivergence {
  intendedAddress: string;
  intendedLabel?: string;
  pastedAddress: string;
  prefixMatch: number;
  suffixMatch: number;
  source: string;
}

export interface ClipboardSanitizerVerdict {
  isCompromised: boolean;
  issueType: SanitizerIssueType;
  severity: SanitizerSeverity;
  title: string;
  message: string;
  cleanedAddress: string;
  originalRaw: string;
  strippedCount: number;
  divergence?: AddressDivergence;
}

export interface InspectAddressParams {
  rawInput: string;
  knownReferences?: KnownReference[];
  maxClipboardAgeMs?: number;
}

// In-memory session store for addresses copied within Privatum
let recentCopiedAddresses: CopiedAddressRecord[] = [];

/**
 * Register an address copied by the user inside Privatum.
 */
export function recordCopiedAddress(address: string, label?: string): void {
  if (!address || typeof address !== "string") return;
  const normalized = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) return;

  const entry: CopiedAddressRecord = {
    address: normalized,
    label: label?.trim() || undefined,
    copiedAt: Date.now(),
  };

  // Keep most recent first, max 10 entries
  recentCopiedAddresses = [
    entry,
    ...recentCopiedAddresses.filter((r) => r.address !== normalized),
  ].slice(0, 10);
}

/**
 * Retrieve the most recently copied address if within the time window.
 */
export function getRecentCopiedAddress(maxAgeMs = 300000): CopiedAddressRecord | null {
  const now = Date.now();
  const valid = recentCopiedAddresses.find((r) => now - r.copiedAt <= maxAgeMs);
  return valid || null;
}

/**
 * Clear the in-memory copied address history (for testing or session reset).
 */
export function clearCopiedAddressHistory(): void {
  recentCopiedAddresses = [];
}

/**
 * Strips zero-width spaces, directional formatting characters, soft hyphens,
 * and normalizes unicode spaces.
 */
export function stripHiddenUnicode(text: string): {
  cleaned: string;
  strippedCount: number;
  removedTypes: string[];
} {
  if (!text) return { cleaned: "", strippedCount: 0, removedTypes: [] };

  const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF\u2060]/g;
  const directionalRegex = /[\u202A\u202B\u202C\u202D\u202E\u2066\u2067\u2068\u2069]/g;
  const softHyphenRegex = /\u00AD/g;
  const unicodeSpacesRegex = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

  let strippedCount = 0;
  const removedTypes: string[] = [];

  const zeroWidthMatches = text.match(zeroWidthRegex);
  if (zeroWidthMatches) {
    strippedCount += zeroWidthMatches.length;
    removedTypes.push("zero-width-space");
  }

  const directionalMatches = text.match(directionalRegex);
  if (directionalMatches) {
    strippedCount += directionalMatches.length;
    removedTypes.push("bidi-override");
  }

  const softHyphenMatches = text.match(softHyphenRegex);
  if (softHyphenMatches) {
    strippedCount += softHyphenMatches.length;
    removedTypes.push("soft-hyphen");
  }

  const unicodeSpaceMatches = text.match(unicodeSpacesRegex);
  if (unicodeSpaceMatches) {
    strippedCount += unicodeSpaceMatches.length;
    removedTypes.push("unicode-space");
  }

  const cleaned = text
    .replace(zeroWidthRegex, "")
    .replace(directionalRegex, "")
    .replace(softHyphenRegex, "")
    .replace(unicodeSpacesRegex, " ")
    .trim();

  return { cleaned, strippedCount, removedTypes };
}

function hexBody(address: string): string {
  return address.trim().toLowerCase().replace(/^0x/, "");
}

export function computeCommonPrefix(a: string, b: string): number {
  const x = hexBody(a);
  const y = hexBody(b);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

export function computeCommonSuffix(a: string, b: string): number {
  const x = hexBody(a);
  const y = hexBody(b);
  let i = 0;
  while (i < x.length && i < y.length && x[x.length - 1 - i] === y[y.length - 1 - i]) i++;
  return i;
}

/**
 * Inspect a pasted address or typed input for clipboard tampering and lookalike poisoning.
 */
export function inspectPastedAddress(params: InspectAddressParams): ClipboardSanitizerVerdict {
  const { rawInput, knownReferences = [], maxClipboardAgeMs = 300000 } = params;

  const { cleaned, strippedCount } = stripHiddenUnicode(rawInput);
  const normalizedPasted = cleaned.trim().toLowerCase();

  // Return clean if not a full EVM address
  const isEvmAddress = /^0x[0-9a-f]{40}$/.test(normalizedPasted);
  if (!isEvmAddress) {
    if (strippedCount > 0) {
      return {
        isCompromised: false,
        issueType: "invisible_unicode",
        severity: "info",
        title: "Hidden Characters Sanitized",
        message: `Removed ${strippedCount} hidden character(s) from input.`,
        cleanedAddress: cleaned,
        originalRaw: rawInput,
        strippedCount,
      };
    }
    return {
      isCompromised: false,
      issueType: "none",
      severity: "clean",
      title: "Input Clean",
      message: "No issues detected.",
      cleanedAddress: cleaned,
      originalRaw: rawInput,
      strippedCount: 0,
    };
  }

  // 1. Check for In-App Clipper Tampering (Targeted Address Substitution)
  const lastCopied = getRecentCopiedAddress(maxClipboardAgeMs);
  if (lastCopied && lastCopied.address !== normalizedPasted) {
    const prefix = computeCommonPrefix(lastCopied.address, normalizedPasted);
    const suffix = computeCommonSuffix(lastCopied.address, normalizedPasted);

    // If pasted address shares first 4 and last 4 characters with the copied address: classic clipper attack
    if (prefix >= 4 && suffix >= 4) {
      const labelDesc = lastCopied.label ? `for "${lastCopied.label}"` : "";
      return {
        isCompromised: true,
        issueType: "clipper_tamper",
        severity: "danger",
        title: "Potential Clipboard Hijacker (Clipper) Detected",
        message: `You recently copied an address ${labelDesc} (${lastCopied.address.slice(0, 6)}...${lastCopied.address.slice(-4)}), but the pasted address differs in the middle. Clipboard malware may have swapped your destination.`,
        cleanedAddress: cleaned,
        originalRaw: rawInput,
        strippedCount,
        divergence: {
          intendedAddress: lastCopied.address,
          intendedLabel: lastCopied.label || "Recently copied address",
          pastedAddress: normalizedPasted,
          prefixMatch: prefix,
          suffixMatch: suffix,
          source: "in_app_clipboard",
        },
      };
    }

    // If pasted within 60 seconds and address is completely different
    const timeSinceCopySec = Math.floor((Date.now() - lastCopied.copiedAt) / 1000);
    if (timeSinceCopySec <= 60) {
      const labelDesc = lastCopied.label ? `"${lastCopied.label}"` : "an in-app address";
      return {
        isCompromised: false,
        issueType: "clipboard_mismatch",
        severity: "warning",
        title: "Pasted Address Differs From Copied Address",
        message: `You copied ${labelDesc} ${timeSinceCopySec}s ago (${lastCopied.address.slice(0, 6)}...${lastCopied.address.slice(-4)}), but pasted a different address. Confirm your intended destination.`,
        cleanedAddress: cleaned,
        originalRaw: rawInput,
        strippedCount,
        divergence: {
          intendedAddress: lastCopied.address,
          intendedLabel: lastCopied.label || "Recently copied address",
          pastedAddress: normalizedPasted,
          prefixMatch: prefix,
          suffixMatch: suffix,
          source: "in_app_clipboard",
        },
      };
    }
  }

  // 2. Lookalike Scan Against Known References (Contacts, Whitelist, Own Accounts)
  for (const ref of knownReferences) {
    const refNormalized = ref.address.trim().toLowerCase();
    if (refNormalized === normalizedPasted) {
      // Exact match to an approved contact or whitelist entry: safe
      continue;
    }

    const prefix = computeCommonPrefix(refNormalized, normalizedPasted);
    const suffix = computeCommonSuffix(refNormalized, normalizedPasted);

    if (prefix >= 4 && suffix >= 4) {
      const sourceName =
        ref.source === "whitelist"
          ? "Approved Whitelist"
          : ref.source === "contact"
          ? "Saved Contact"
          : ref.source === "account"
          ? "Your Account"
          : "Past Recipient";

      return {
        isCompromised: true,
        issueType: "lookalike_poison",
        severity: "danger",
        title: `Look-alike Address Detected (${sourceName})`,
        message: `This address shares the first ${prefix} and last ${suffix} characters of ${sourceName} "${ref.label}", but has a different middle. Verify every character against your offline records.`,
        cleanedAddress: cleaned,
        originalRaw: rawInput,
        strippedCount,
        divergence: {
          intendedAddress: refNormalized,
          intendedLabel: ref.label,
          pastedAddress: normalizedPasted,
          prefixMatch: prefix,
          suffixMatch: suffix,
          source: ref.source,
        },
      };
    }
  }

  // 3. Invisible Unicode Notification if clean of lookalikes
  if (strippedCount > 0) {
    return {
      isCompromised: false,
      issueType: "invisible_unicode",
      severity: "info",
      title: "Hidden Characters Removed",
      message: `Sanitized ${strippedCount} hidden/zero-width character(s) from the pasted address.`,
      cleanedAddress: cleaned,
      originalRaw: rawInput,
      strippedCount,
    };
  }

  // 4. Default Clean
  return {
    isCompromised: false,
    issueType: "none",
    severity: "clean",
    title: "Address Verified Clean",
    message: "No clipboard anomalies or look-alike collisions detected.",
    cleanedAddress: cleaned,
    originalRaw: rawInput,
    strippedCount: 0,
  };
}
