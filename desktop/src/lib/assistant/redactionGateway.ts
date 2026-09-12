/**
 * Client-Side Ingress Redaction Gateway
 *
 * Strictly enforces the "No Secrets to AI" rule from the Privatum V2 Privacy & AI Strategy Brief.
 * Runs prior to any model context creation or prompt ingestion.
 * Detects and blocks private keys, shard secrets, and seed phrases.
 */

export interface RedactionResult {
  allowed: boolean;
  sanitized: string;
  reason?: string;
  detectedType?: "private_key" | "mnemonic" | "shard_secret";
}

// 64-character hexadecimal pattern (with or without 0x prefix)
const HEX_PRIVATE_KEY_REGEX = /(?:0x)?[a-fA-F0-9]{64}/g;

// High-entropy 32-byte secret pattern
const RAW_HEX_32_REGEX = /\b[a-fA-F0-9]{64}\b/g;

/**
 * Validates and redacts user input before it can enter any AI model context.
 */
export function sanitizePromptIngress(prompt: string): RedactionResult {
  if (!prompt || typeof prompt !== "string") {
    return { allowed: true, sanitized: "" };
  }

  const trimmed = prompt.trim();

  // 1. Check for 64-character hex private keys or shard keys
  if (HEX_PRIVATE_KEY_REGEX.test(trimmed) || RAW_HEX_32_REGEX.test(trimmed)) {
    return {
      allowed: false,
      sanitized: "[BLOCKED_SECRET_REDACTED]",
      reason: "Private key or raw cryptographic secret detected. Privatum V2 strictly prohibits secrets from entering AI context.",
      detectedType: "private_key",
    };
  }

  // 2. Check for BIP-39 12-word or 24-word mnemonic seed phrases
  const tokens = trimmed.toLowerCase().split(/[\s,]+/);
  if (tokens.length === 12 || tokens.length === 24) {
    const isMnemonicCandidate = tokens.every(
      (t) => t.length >= 3 && t.length <= 8 && /^[a-z]+$/.test(t)
    );
    if (isMnemonicCandidate) {
      return {
        allowed: false,
        sanitized: "[BLOCKED_MNEMONIC_REDACTED]",
        reason: "Seed phrase detected. Privatum V2 strictly prohibits mnemonic words from entering AI context.",
        detectedType: "mnemonic",
      };
    }
  }

  // 3. Scrub any accidental auth tokens or key prefixes
  let sanitized = trimmed
    .replace(/(?:apiKey|api_key|Bearer)\s+[:=]?\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, "[REDACTED_API_KEY]")
    .replace(/privatum_[a-z0-9_]{10,}/gi, "[REDACTED_KEY_IDENTIFIER]");

  return {
    allowed: true,
    sanitized,
  };
}
