/**
 * Local Natural Language Security Policy Intelligence for PRIVATUM Assistant.
 *
 * Resolves conversational inquiries and actions regarding:
 * 1. Counterparty Whitelist checks and Strict Treasury Mode status.
 * 2. Curated and custom Threat Blacklist detection and threat classifications.
 * 3. Deep Address Guard character-level poisoning and lookalike diagnostics.
 * 4. Actionable security intents: add/remove whitelist, add/remove blacklist.
 * 5. Whole-wallet security posture overviews.
 *
 * 100% client-side and deterministic: executes in memory over local state with zero external queries.
 */

import type { Contact } from "../contacts";
import type { WhitelistEntry, WhitelistConfig } from "../transferWhitelist";
import {
  isValidWhitelistAddress,
  normalizeWhitelistAddress,
  isWhitelisted,
} from "../transferWhitelist";
import type { BlacklistEntry, BlacklistCategory } from "../transferBlacklist";
import {
  checkAddressBlacklist,
  getAllBlacklistEntries,
  CURATED_THREAT_FEED,
} from "../transferBlacklist";
import type { AddressGuardHistoryEntry } from "../addressGuard";
import {
  checkAddressPoisoning,
  commonPrefixLength,
  commonSuffixLength,
  isPlainAddress,
} from "../addressGuard";
import type {
  ParsedAddWhitelistIntent,
  ParsedRemoveWhitelistIntent,
  ParsedAddBlacklistIntent,
  ParsedRemoveBlacklistIntent,
  ParsedSecurityQueryIntent,
} from "./types";

export interface SecurityQueryContext {
  walletAddress?: string;
  contacts?: Contact[];
  whitelistEntries?: WhitelistEntry[];
  whitelistConfig?: WhitelistConfig;
  blacklistEntries?: BlacklistEntry[];
  transactionHistory?: AddressGuardHistoryEntry[];
}

export interface SecurityQueryResult {
  handled: boolean;
  summary: string;
  details?: string[];
  queryType?:
    | "whitelist_status"
    | "blacklist_status"
    | "threat_diagnostic"
    | "poisoning_diagnostic"
    | "policy_overview";
  intent?:
    | ParsedAddWhitelistIntent
    | ParsedRemoveWhitelistIntent
    | ParsedAddBlacklistIntent
    | ParsedRemoveBlacklistIntent
    | ParsedSecurityQueryIntent;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Extracts an Ethereum address (0x...) or resolves a contact name from the input.
 */
function extractTargetAddress(
  input: string,
  contacts: Contact[] = []
): { address: string; label?: string } | null {
  const hexMatch = input.match(/0x[a-fA-F0-9]{40}/);
  if (hexMatch) {
    const addr = hexMatch[0].toLowerCase();
    const matched = contacts.find((c) => c.address.toLowerCase() === addr);
    return { address: addr, label: matched?.name };
  }

  // Attempt contact name resolution
  const lower = input.toLowerCase();
  for (const contact of contacts) {
    if (contact.name && lower.includes(contact.name.toLowerCase())) {
      return { address: contact.address.toLowerCase(), label: contact.name };
    }
  }

  return null;
}

/**
 * Evaluates security policy queries and generates actionable intents.
 */
export function evaluateSecurityQuery(
  input: string,
  context: SecurityQueryContext
): SecurityQueryResult | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const {
    walletAddress = "",
    contacts = [],
    whitelistEntries = [],
    whitelistConfig = { strictMode: false },
    blacklistEntries = [],
    transactionHistory = [],
  } = context;

  const target = extractTargetAddress(clean, contacts);

  // 1. Actionable intent: Add to Whitelist
  // e.g. "whitelist 0x...", "add 0x... to whitelist", "approve address 0x...", "whitelist Alice"
  if (
    !/(?:how\s+does|what\s+is|explain|tell\s+me)/i.test(lower) &&
    (/(?:add\s+.*?to\s+(?:the\s+)?whitelist|add\s+(?:to\s+)?whitelist|approve\s+(?:counterparty|address))/i.test(lower) ||
      /^(?:whitelist|approve)\s+/i.test(lower)) &&
    !/(?:remove|delete|unwhitelist|from\s+whitelist)/i.test(lower) &&
    !/(?:is\s+|check\s+|show\s+|who\s+is)/i.test(lower)
  ) {
    if (!target) {
      return {
        handled: true,
        summary: "Please specify a valid Ethereum address (0x...) or contact name to add to your approved whitelist.",
        details: ["Example: 'Add 0x3f8a0000000000000000000000000000000091b2 to whitelist'"],
      };
    }

    const alreadyWhitelisted = isWhitelisted(target.address, whitelistEntries);
    const label = target.label || `Approved (${shortenAddr(target.address)})`;

    return {
      handled: true,
      summary: alreadyWhitelisted
        ? `Address ${shortenAddr(target.address)} is already present in your approved whitelist.`
        : `Ready to approve ${shortenAddr(target.address)}${target.label ? ` (${target.label})` : ""} and add to your trusted counterparty whitelist.`,
      details: [
        `Address: ${target.address}`,
        `Label: ${label}`,
        `Strict Mode: ${whitelistConfig.strictMode ? "Active (blocks unwhitelisted transfers)" : "Advisory"}`,
      ],
      intent: {
        type: "add_whitelist",
        address: target.address,
        label,
      },
    };
  }

  // 2. Actionable intent: Remove from Whitelist
  // e.g. "remove 0x... from whitelist", "unwhitelist 0x...", "delete 0x... from whitelist"
  if (
    /(?:remove|delete|unwhitelist)\s+(?:0x[a-f0-9]{40}|[a-z0-9_\s]+)?(?:\s+from\s+whitelist)?/i.test(
      lower
    ) &&
    /(?:whitelist)/i.test(lower)
  ) {
    if (!target) {
      return {
        handled: true,
        summary: "Please specify the Ethereum address (0x...) or contact name to remove from your approved whitelist.",
      };
    }

    const existing = whitelistEntries.find(
      (e) => normalizeWhitelistAddress(e.address) === normalizeWhitelistAddress(target.address)
    );

    return {
      handled: true,
      summary: existing
        ? `Ready to revoke whitelist approval for ${shortenAddr(target.address)} (${existing.label}).`
        : `Address ${shortenAddr(target.address)} was not found in your active whitelist.`,
      details: [
        `Address: ${target.address}`,
        `Current Status: ${existing ? "Approved" : "Not whitelisted"}`,
      ],
      intent: {
        type: "remove_whitelist",
        address: target.address,
        label: existing?.label,
      },
    };
  }

  // 3. Actionable intent: Add to Blacklist
  // e.g. "blacklist 0x...", "block address 0x...", "ban 0x...", "add 0x... to blacklist"
  if (
    !/(?:how\s+does|what\s+is|explain|tell\s+me)/i.test(lower) &&
    (/(?:add\s+.*?to\s+(?:the\s+)?blacklist|add\s+(?:to\s+)?blacklist|block\s+(?:address|counterparty)|ban\s+address)/i.test(lower) ||
      /^(?:blacklist|block|ban)\s+/i.test(lower)) &&
    !/(?:remove|unblock|unblacklist|from\s+blacklist)/i.test(lower) &&
    !/(?:is\s+|check\s+|why\s+|show\s+|how\s+many)/i.test(lower)
  ) {
    if (!target) {
      return {
        handled: true,
        summary: "Please specify a valid Ethereum address (0x...) to add to your threat blocklist.",
        details: ["Example: 'Blacklist 0x0000490b8f4ebf2ffdc1fb66bc2f210515aa0000 as Phishing'"],
      };
    }

    let category: BlacklistCategory = "Custom";
    if (lower.includes("phish")) category = "Phishing";
    else if (lower.includes("malicious") || lower.includes("drainer") || lower.includes("scam")) category = "Malicious";
    else if (lower.includes("sanction")) category = "Sanctioned";
    else if (lower.includes("compromis")) category = "Compromised";

    const reason = `Blocked via Privatum Assistant (${category})`;

    return {
      handled: true,
      summary: `Ready to block counterparty ${shortenAddr(target.address)}${target.label ? ` (${target.label})` : ""} and enforce transfer restriction.`,
      details: [
        `Address: ${target.address}`,
        `Category: ${category}`,
        `Reason: ${reason}`,
        "When blacklisted, transfers to this destination will be strictly blocked in the Send flow.",
      ],
      intent: {
        type: "add_blacklist",
        address: target.address,
        name: target.label,
        reason,
        category,
      },
    };
  }

  // 4. Actionable intent: Remove from Blacklist
  // e.g. "remove 0x... from blacklist", "unblock 0x...", "unblacklist 0x..."
  if (
    /(?:remove\s+0x[a-f0-9]{40}\s+from\s+blacklist|unblock\s+address|unblock\s+0x|unblacklist)/i.test(
      lower
    ) ||
    ((lower.includes("remove") || lower.includes("unblock")) && lower.includes("blacklist"))
  ) {
    if (!target) {
      return {
        handled: true,
        summary: "Please specify the Ethereum address (0x...) to unblock from your blacklist.",
      };
    }

    const all = getAllBlacklistEntries(blacklistEntries);
    const existing = all.find(
      (b) => b.address.toLowerCase() === target.address.toLowerCase()
    );

    const isCurated = existing?.source === "curated";

    return {
      handled: true,
      summary: existing
        ? isCurated
          ? `Address ${shortenAddr(target.address)} is part of the immutable curated threat feed (${existing.name || existing.reason}) and cannot be removed.`
          : `Ready to unblock ${shortenAddr(target.address)} and restore standard transaction routing.`
        : `Address ${shortenAddr(target.address)} is not present in your blacklist.`,
      details: [
        `Address: ${target.address}`,
        `Source: ${existing ? (isCurated ? "Curated Threat Feed" : "Custom User Rule") : "Not Listed"}`,
        ...(existing?.reason ? [`Recorded Reason: ${existing.reason}`] : []),
      ],
      intent: existing && !isCurated
        ? {
            type: "remove_blacklist",
            address: target.address,
            name: existing.name,
          }
        : undefined,
    };
  }

  // 5. Inquiry: Whitelist check / inquiry
  // e.g. "is 0x... whitelisted?", "check whitelist for 0x...", "who is on my whitelist?", "show whitelist"
  if (
    !/(?:how\s+does|what\s+is\s+(?:the\s+|a\s+)?whitelist|explain\s+(?:the\s+|a\s+)?whitelist)/i.test(lower) &&
    /(?:is\s+(?:0x[a-f0-9]{40}|[a-z0-9_\s]+)?\s*(?:on\s+(?:my\s+)?whitelist|whitelisted)|check\s+whitelist|show\s+(?:my\s+)?whitelist|who\s+is\s+on\s+(?:my\s+)?whitelist|whitelist\s+status)/i.test(
      lower
    )
  ) {
    if (target) {
      const match = whitelistEntries.find(
        (e) => normalizeWhitelistAddress(e.address) === normalizeWhitelistAddress(target.address)
      );
      const isApproved = Boolean(match);

      return {
        handled: true,
        queryType: "whitelist_status",
        summary: isApproved
          ? `Address ${shortenAddr(target.address)} IS approved in your whitelist (${match?.label}).`
          : `Address ${shortenAddr(target.address)} is NOT currently in your approved whitelist.`,
        details: [
          `Address: ${target.address}`,
          `Status: ${isApproved ? "Approved" : "Unapproved"}`,
          `Strict Treasury Mode: ${whitelistConfig.strictMode ? "Enabled (unapproved transfers are blocked)" : "Disabled (advisory only)"}`,
          ...(match?.note ? [`Note: ${match.note}`] : []),
        ],
        intent: {
          type: "security_query",
          queryType: "whitelist_status",
          address: target.address,
          summary: isApproved
            ? `Address ${shortenAddr(target.address)} is whitelisted.`
            : `Address ${shortenAddr(target.address)} is not whitelisted.`,
        },
      };
    }

    // General whitelist summary
    const count = whitelistEntries.length;
    const details = [
      `Total Approved Counterparties: ${count}`,
      `Enforcement Mode: ${whitelistConfig.strictMode ? "Strict Mode (blocks unapproved transfers)" : "Advisory Mode"}`,
    ];

    if (count > 0) {
      details.push("Approved Counterparties:");
      for (const entry of whitelistEntries.slice(0, 5)) {
        details.push(`* ${entry.label}: ${shortenAddr(entry.address)}${entry.note ? ` - ${entry.note}` : ""}`);
      }
      if (count > 5) {
        details.push(`...and ${count - 5} more approved counterparty entry(s).`);
      }
    } else {
      details.push("Your whitelist is currently empty. Type 'Add 0x... to whitelist' to approve a counterparty.");
    }

    return {
      handled: true,
      queryType: "whitelist_status",
      summary: `Counterparty Whitelist contains ${count} approved entry(s). Strict mode is ${whitelistConfig.strictMode ? "ACTIVE" : "inactive"}.`,
      details,
      intent: {
        type: "security_query",
        queryType: "whitelist_status",
        summary: `Whitelist tracking ${count} entries.`,
      },
    };
  }

  // 6. Inquiry: Blacklist check / inquiry / threat classification
  // e.g. "is 0x... blacklisted?", "check blacklist for 0x...", "why is 0x... blocked?", "how many blacklisted addresses?"
  if (
    !/(?:how\s+does|what\s+is\s+(?:the\s+|a\s+)?blacklist|explain\s+(?:the\s+|a\s+)?blacklist)/i.test(lower) &&
    /(?:is\s+(?:0x[a-f0-9]{40}|[a-z0-9_\s]+)?\s*(?:on\s+(?:my\s+)?blacklist|blacklisted|blocked)|check\s+blacklist|why\s+is\s+0x[a-f0-9]{40}\s+(?:blocked|blacklisted)|how\s+many\s+blacklisted|blacklist\s+status|show\s+(?:my\s+)?blacklist)/i.test(
      lower
    )
  ) {
    const all = getAllBlacklistEntries(blacklistEntries);

    if (target) {
      const match = all.find(
        (b) => b.address.toLowerCase() === target.address.toLowerCase()
      );
      const isBlocked = Boolean(match);

      if (isBlocked && match) {
        return {
          handled: true,
          queryType: "threat_diagnostic",
          summary: `Address ${shortenAddr(target.address)} IS BLACKLISTED (${match.category}: ${match.name || "Known Threat"}).`,
          details: [
            `Address: ${target.address}`,
            ...(match.name ? [`Threat Name: ${match.name}`] : []),
            `Classification: ${match.category}`,
            `Threat Reason: ${match.reason}`,
            `Source Feed: ${match.source === "curated" ? "Curated Threat Intelligence" : "Custom User Block"}`,
            "Safety Action: Transfers to this address are strictly restricted.",
          ],
          intent: {
            type: "security_query",
            queryType: "threat_diagnostic",
            address: target.address,
            summary: `Blacklisted (${match.category}): ${match.reason}`,
          },
        };
      }

      return {
        handled: true,
        queryType: "blacklist_status",
        summary: `Address ${shortenAddr(target.address)} is NOT blacklisted. No active threat indicators match this address.`,
        details: [
          `Address: ${target.address}`,
          `Curated Threat Database: 0 matches`,
          `User Custom Blacklist: 0 matches`,
        ],
        intent: {
          type: "security_query",
          queryType: "blacklist_status",
          address: target.address,
          summary: `Address ${shortenAddr(target.address)} is clean.`,
        },
      };
    }

    // General blacklist overview
    const curatedCount = CURATED_THREAT_FEED.length;
    const userCount = blacklistEntries.filter((b) => b.source === "user").length;

    return {
      handled: true,
      queryType: "blacklist_status",
      summary: `Blacklist Guard actively enforces ${all.length} threat rules (${curatedCount} curated, ${userCount} custom).`,
      details: [
        `Curated Threat Feed: ${curatedCount} known phishing drainers, OFAC sanctions, and burn sinks`,
        `Custom User Rules: ${userCount} manually blocked addresses`,
        "All outgoing transfers are screened against these rules before signing.",
      ],
      intent: {
        type: "security_query",
        queryType: "blacklist_status",
        summary: `Blacklist tracking ${all.length} rules.`,
      },
    };
  }

  // 7. Inquiry: Deep Address Guard / Lookalike Poisoning Diagnostics
  // e.g. "why is 0x... flagged?", "inspect address 0x...", "is 0x... poisoned?", "lookalike check for 0x..."
  if (
    /(?:why\s+is\s+(?:0x[a-f0-9]{40}|[a-z0-9_\s]+)?\s*flagged|inspect\s+address|is\s+0x[a-f0-9]{40}\s+poisoned|explain\s+poisoning|look-?alike\s+check)/i.test(
      lower
    ) ||
    ((lower.includes("flagged") || lower.includes("poison")) && target)
  ) {
    if (!target) {
      return {
        handled: true,
        summary: "Please specify the Ethereum address (0x...) you would like to inspect for poisoning and lookalike spoofing.",
      };
    }

    const ownAddrs = [walletAddress, ...contacts.map((c) => c.address)].filter(Boolean);
    const verdict = checkAddressPoisoning({
      recipient: target.address,
      history: transactionHistory,
      ownAddresses: ownAddrs,
    });

    const isSuspicious = verdict.level === "warning" || verdict.level === "danger";
    const details = [
      `Inspected Address: ${target.address}`,
      `Safety Level: ${verdict.level.toUpperCase()} (${verdict.title})`,
      `Detail: ${verdict.detail}`,
    ];

    let lookalikeOf = verdict.lookalikeOf;
    let prefixCount = verdict.prefixMatch || 0;
    let suffixCount = verdict.suffixMatch || 0;

    if (!lookalikeOf) {
      const candidates = [
        ...ownAddrs,
        ...transactionHistory
          .filter((h) => h.type === "send" && isPlainAddress(h.counterparty))
          .map((h) => h.counterparty.trim().toLowerCase()),
      ];
      let bestScore = -1;
      for (const known of candidates) {
        if (known.toLowerCase() === target.address.toLowerCase()) continue;
        const p = commonPrefixLength(target.address, known);
        const s = commonSuffixLength(target.address, known);
        if ((p >= 4 && s >= 4) || p >= 6 || s >= 6) {
          if (p + s > bestScore) {
            bestScore = p + s;
            lookalikeOf = known;
            prefixCount = p;
            suffixCount = s;
          }
        }
      }
    }

    if (lookalikeOf) {
      if (!verdict.lookalikeOf) {
        prefixCount = commonPrefixLength(target.address, lookalikeOf);
        suffixCount = commonSuffixLength(target.address, lookalikeOf);
      }
      const spoofedContact = contacts.find(
        (c) => c.address.toLowerCase() === lookalikeOf?.toLowerCase()
      );

      details.push("");
      details.push("Address Poisoning Analysis:");
      details.push(`* Impersonated Address: ${lookalikeOf}${spoofedContact ? ` (${spoofedContact.name})` : ""}`);
      details.push(`* Matching Prefix Length: First ${prefixCount} hex characters match identically`);
      details.push(`* Matching Suffix Length: Last ${suffixCount} hex characters match identically`);
      details.push(
        "* Attack Mechanism: Attackers use vanity address generators to replicate the visible ends of your frequent contacts, then dust your history so you accidentally copy the attacker's address."
      );
      details.push("* Recommendation: Do not copy addresses from transaction history. Use your encrypted address book or verified whitelist.");
    } else if (!isSuspicious) {
      details.push("No lookalike poisoning indicators detected against your historical counterparties.");
    }

    return {
      handled: true,
      queryType: "poisoning_diagnostic",
      summary: isSuspicious
        ? `Security Alert: Address ${shortenAddr(target.address)} is flagged as a potential lookalike spoofing attack.`
        : `Address Guard: ${shortenAddr(target.address)} is clean. No lookalike spoofing detected.`,
      details,
      intent: {
        type: "security_query",
        queryType: "poisoning_diagnostic",
        address: target.address,
        summary: verdict.detail,
      },
    };
  }

  // 8. Inquiry: Security Policy Overview
  // e.g. "show my security policies", "security policy status", "what are my security rules?", "policy status"
  if (
    /(?:security\s+polic(?:y|ies)|security\s+status|security\s+rules|policy\s+status|security\s+overview)/i.test(
      lower
    )
  ) {
    const allBlacklist = getAllBlacklistEntries(blacklistEntries);
    const userBlacklistCount = blacklistEntries.filter((b) => b.source === "user").length;

    return {
      handled: true,
      queryType: "policy_overview",
      summary: "Privatum Security Policy Summary: Multi-layer defense is active across your local runtime.",
      details: [
        `Counterparty Whitelist: ${whitelistEntries.length} approved addresses (${whitelistConfig.strictMode ? "Strict Mode Active" : "Advisory Mode"})`,
        `Threat Blacklist: ${allBlacklist.length} rules active (${CURATED_THREAT_FEED.length} curated threat feed, ${userBlacklistCount} custom user blocks)`,
        "Address Poisoning Guard: Active (continuous scanning of counterparty prefix and suffix alignment)",
        "Zero Telemetry: Active (all policy checks evaluate 100% locally in device memory)",
      ],
      intent: {
        type: "security_query",
        queryType: "policy_overview",
        summary: "Security policies active and healthy.",
      },
    };
  }

  return null;
}
