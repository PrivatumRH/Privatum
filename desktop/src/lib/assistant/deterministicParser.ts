import { isAddress } from "viem";
import type { Contact } from "../contacts";
import { findToken } from "../tokens";
import type {
  ParsedIntent,
  ParsedTransferIntent,
  ParsedRwaCommandIntent,
  ParsedPaylinkIntent,
  ParsedFreezeIntent,
  ParsedUnfreezeIntent,
  ParsedCheckAddressIntent,
} from "./types";

/**
 * Deterministic Natural Language Parser
 *
 * Provides immediate, zero-download, offline intent parsing for Privatum Desktop.
 * Accurately extracts transfer parameters, contact aliases, amounts, assets,
 * stealth mode, freeze requests, and paylinks.
 */
export function parseDeterministicIntent(
  text: string,
  contacts: Contact[] = []
): ParsedIntent | null {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  // 1. Check Address Intent
  const checkMatch = lower.match(/(?:check|inspect|verify|audit|scan)\s+(?:address\s+)?(0x[a-f0-9]{40})/i);
  if (checkMatch && isAddress(checkMatch[1])) {
    return {
      type: "check_address",
      address: checkMatch[1],
    } as ParsedCheckAddressIntent;
  }

  // 2. Panic Freeze Intent
  if (
    lower.includes("freeze") ||
    lower.includes("lock wallet") ||
    lower.includes("lock account") ||
    lower.includes("panic lock")
  ) {
    if (lower.includes("unfreeze") || lower.includes("unlock")) {
      const codeMatch = lower.match(/\b(\d{6})\b/);
      return {
        type: "unfreeze_wallet",
        code: codeMatch ? codeMatch[1] : undefined,
      } as ParsedUnfreezeIntent;
    }

    let hours: number | null = 24;
    if (lower.includes("1 hour") || lower.includes("1h")) {
      hours = 1;
    } else if (lower.includes("72 hour") || lower.includes("3 day") || lower.includes("72h")) {
      hours = 72;
    } else if (lower.includes("until") || lower.includes("permanent") || lower.includes("forever")) {
      hours = null;
    }

    return {
      type: "panic_freeze",
      hours,
    } as ParsedFreezeIntent;
  }

  // 3. Unfreeze Intent
  if (lower.includes("unfreeze") || lower.includes("unlock")) {
    const codeMatch = lower.match(/\b(\d{6})\b/);
    return {
      type: "unfreeze_wallet",
      code: codeMatch ? codeMatch[1] : undefined,
    } as ParsedUnfreezeIntent;
  }

  // 4. Pay Link Generation Intent
  if (
    lower.includes("paylink") ||
    lower.includes("pay link") ||
    lower.includes("payment link") ||
    lower.includes("disposable link")
  ) {
    const amountMatch = lower.match(/(?:for\s+)?([0-9]+(?:\.[0-9]+)?)\s*(usdg|eth)?/i);
    const asset: "ETH" | "USDG" = lower.includes("eth") ? "ETH" : "USDG";
    const amount = amountMatch ? amountMatch[1] : "10";

    const memoMatch = normalized.match(/(?:memo|note|for|desc|reason)\s+[:=]?\s*["']?([^"']+)["']?$/i);
    const memo = memoMatch ? memoMatch[1].trim() : undefined;

    return {
      type: "create_paylink",
      amount,
      asset,
      memo,
    } as ParsedPaylinkIntent;
  }

  // 5. Guardrail / Limit Query
  if (
    lower.includes("guardrail") ||
    lower.includes("spending limit") ||
    lower.includes("daily limit") ||
    lower.includes("how much have i spent")
  ) {
    return { type: "view_guardrails" };
  }

  // 6. Contacts Query
  if (lower.includes("contact") || lower.includes("address book")) {
    return { type: "view_contacts" };
  }

  // 6b. Export Ledger Query
  if (
    lower.includes("export") ||
    lower.includes("download ledger") ||
    lower.includes("download transactions") ||
    lower.includes("download tx") ||
    lower.includes("export csv") ||
    lower.includes("export json")
  ) {
    return { type: "export_ledger" };
  }

  // 7. Transfer / Send Intent
  // RWA commands are handled before generic sends so symbols such as AAPL
  // cannot silently fall back to a USDG transfer.
  const rwaSwapMatch = lower.match(/\b(swap|buy|acquire|sell)\s+([0-9]+(?:\.[0-9]+)?)\s*(usdg|eth)?\s*(?:for|of|in)?\s*([a-z][a-z0-9]{1,9})\b/i);
  if (rwaSwapMatch) {
    const action = rwaSwapMatch[1].toLowerCase() === "sell" ? "sell" : rwaSwapMatch[1].toLowerCase() === "swap" ? "swap" : "buy";
    const token = findToken(rwaSwapMatch[4]);
    if (token?.isRwa) {
      const fundingAsset = (rwaSwapMatch[3]?.toUpperCase() === "ETH" ? "ETH" : "USDG") as "USDG" | "ETH";
      return {
        type: "rwa_command",
        action,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenAddress: token.address,
        amount: rwaSwapMatch[2],
        fundingAsset,
        confidence: 0.98,
        requiresExplicitConfirmation: true,
      } as ParsedRwaCommandIntent;
    }
  }

  // A direct RWA send is intentionally surfaced as a guarded RWA command,
  // never silently treated as a USDG transfer.
  const directRwaMatch = lower.match(/\b(?:send|transfer)\s+([0-9]+(?:\.[0-9]+)?)\s*([a-z][a-z0-9]{1,9})\b/i);
  if (directRwaMatch) {
    const token = findToken(directRwaMatch[2]);
    if (token?.isRwa) {
      return {
        type: "rwa_command",
        action: "sell",
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenAddress: token.address,
        amount: directRwaMatch[1],
        fundingAsset: "USDG",
        confidence: 0.9,
        requiresExplicitConfirmation: true,
      } as ParsedRwaCommandIntent;
    }
  }

  // 7b. Standard transfer / send intent
  if (
    lower.startsWith("send") ||
    lower.startsWith("transfer") ||
    lower.startsWith("pay") ||
    lower.includes("send ") ||
    lower.includes("transfer ")
  ) {
    // Detect stealth preference
    const isStealth =
      lower.includes("stealth") ||
      lower.includes("privately") ||
      lower.includes("private send") ||
      lower.includes("anonymous");

    // Detect asset
    const asset: "ETH" | "USDG" = lower.includes("eth") ? "ETH" : "USDG";

    // Detect amount
    const amountRegex = /\b([0-9]+(?:\.[0-9]+)?)\s*(?:usdg|eth)?\b/i;
    const amountMatch = normalized.match(amountRegex);
    const amount = amountMatch ? amountMatch[1] : "0";

    // Detect recipient (either 0x address or contact name)
    const addrMatch = normalized.match(/(0x[a-fA-F0-9]{40})/);
    let recipient = "";
    let recipientName: string | undefined;

    if (addrMatch && isAddress(addrMatch[1])) {
      recipient = addrMatch[1];
      // Check if matches an existing contact
      const matched = contacts.find((c) => c.address.toLowerCase() === recipient.toLowerCase());
      if (matched) recipientName = matched.name;
    } else {
      // Look for "to <name>" or match words against contacts
      const toMatch = normalized.match(/(?:to\s+)([a-zA-Z0-9_\- ]+)/i);
      const targetQuery = toMatch ? toMatch[1].trim().toLowerCase() : "";

      if (targetQuery) {
        const found = contacts.find(
          (c) => c.name.toLowerCase() === targetQuery || targetQuery.includes(c.name.toLowerCase())
        );
        if (found) {
          recipient = found.address;
          recipientName = found.name;
        }
      }

      if (!recipient) {
        // Broad search across contacts
        for (const c of contacts) {
          if (lower.includes(c.name.toLowerCase())) {
            recipient = c.address;
            recipientName = c.name;
            break;
          }
        }
      }
    }

    if (recipient) {
      return {
        type: "send_transfer",
        recipient,
        recipientName,
        amount,
        asset,
        isStealth,
        confidence: 0.95,
      } as ParsedTransferIntent;
    }
  }

  // 8. Explain Transaction
  const txMatch = normalized.match(/(?:tx|transaction)\s+(0x[a-fA-F0-9]{64})/i);
  if (txMatch) {
    return {
      type: "explain_tx",
      txHash: txMatch[1],
    };
  }

  return {
    type: "general_query",
    query: normalized,
  };
}
