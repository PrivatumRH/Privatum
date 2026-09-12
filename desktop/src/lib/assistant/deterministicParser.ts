import { isAddress } from "viem";
import type { Contact } from "../contacts";
import type {
  ParsedIntent,
  ParsedTransferIntent,
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

  // 7. Transfer / Send Intent
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

  return null;
}
