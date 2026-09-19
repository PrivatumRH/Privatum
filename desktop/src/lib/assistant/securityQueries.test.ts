import { describe, it, expect, beforeEach } from "bun:test";
import { evaluateSecurityQuery } from "./securityQueries";
import type { WhitelistEntry, WhitelistConfig } from "../transferWhitelist";
import type { BlacklistEntry } from "../transferBlacklist";
import type { Contact } from "../contacts";
import type { AddressGuardHistoryEntry } from "../addressGuard";

describe("Local Natural Language Security Policy Intelligence", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  });

  const mockWallet = "0x1111111111111111111111111111111111111111";

  const sampleContacts: Contact[] = [
    {
      id: "c-1",
      name: "Alice Treasury",
      address: "0x3f8a0000000000000000000000000000000091b2",
      category: "Work",
      createdAt: Date.now() - 100000,
    },
    {
      id: "c-2",
      name: "Bob Personal",
      address: "0x7b2200000000000000000000000000000000c418",
      category: "Personal",
      createdAt: Date.now() - 200000,
    },
  ];

  const sampleWhitelist: WhitelistEntry[] = [
    {
      address: "0x3f8a0000000000000000000000000000000091b2",
      label: "Alice Treasury",
      note: "Payroll and operations",
      addedAt: Date.now() - 50000,
    },
  ];

  const sampleBlacklist: BlacklistEntry[] = [
    {
      address: "0x9999000000000000000000000000000000009999",
      name: "Known Impersonator",
      reason: "Blocked by user due to spoof attempt",
      category: "Phishing",
      addedAt: Date.now() - 30000,
      source: "user",
    },
  ];

  const sampleHistory: AddressGuardHistoryEntry[] = [
    {
      type: "send",
      counterparty: "0x3f8a0000000000000000000000000000000091b2",
      amount: "10",
      asset: "USDG",
    },
    {
      type: "receive",
      counterparty: "0x3f8a9999999999999999999999999999999991b2", // lookalike of Alice with same 0x3f8a and 91b2
      amount: "0.0001",
      asset: "ETH",
    },
  ];

  it("yields add_whitelist intent with raw address", () => {
    const result = evaluateSecurityQuery(
      "add 0x7b2200000000000000000000000000000000c418 to whitelist",
      {
        walletAddress: mockWallet,
        contacts: sampleContacts,
        whitelistEntries: sampleWhitelist,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("add_whitelist");
    if (result?.intent?.type === "add_whitelist") {
      expect(result.intent.address).toBe("0x7b2200000000000000000000000000000000c418");
      expect(result.intent.label).toContain("Bob Personal");
    }
  });

  it("yields add_whitelist intent by resolving contact name", () => {
    const result = evaluateSecurityQuery("whitelist Bob Personal", {
      walletAddress: mockWallet,
      contacts: sampleContacts,
      whitelistEntries: sampleWhitelist,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("add_whitelist");
    if (result?.intent?.type === "add_whitelist") {
      expect(result.intent.address).toBe("0x7b2200000000000000000000000000000000c418");
    }
  });

  it("prompts user when address is missing from whitelist command", () => {
    const result = evaluateSecurityQuery("add to whitelist", {
      walletAddress: mockWallet,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.summary).toContain("specify a valid Ethereum address");
    expect(result?.intent).toBeUndefined();
  });

  it("yields remove_whitelist intent for an existing whitelisted address", () => {
    const result = evaluateSecurityQuery(
      "remove 0x3f8a0000000000000000000000000000000091b2 from whitelist",
      {
        walletAddress: mockWallet,
        whitelistEntries: sampleWhitelist,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("remove_whitelist");
    if (result?.intent?.type === "remove_whitelist") {
      expect(result.intent.address).toBe("0x3f8a0000000000000000000000000000000091b2");
      expect(result.intent.label).toBe("Alice Treasury");
    }
  });

  it("yields add_blacklist intent detecting threat category", () => {
    const result = evaluateSecurityQuery(
      "blacklist 0x2222000000000000000000000000000000002222 as phishing",
      {
        walletAddress: mockWallet,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("add_blacklist");
    if (result?.intent?.type === "add_blacklist") {
      expect(result.intent.address).toBe("0x2222000000000000000000000000000000002222");
      expect(result.intent.category).toBe("Phishing");
    }
  });

  it("yields remove_blacklist intent for custom user block", () => {
    const result = evaluateSecurityQuery(
      "unblock 0x9999000000000000000000000000000000009999",
      {
        walletAddress: mockWallet,
        blacklistEntries: sampleBlacklist,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("remove_blacklist");
    if (result?.intent?.type === "remove_blacklist") {
      expect(result.intent.address).toBe("0x9999000000000000000000000000000000009999");
    }
  });

  it("prevents removal of curated threat feed addresses from blacklist", () => {
    // 0xd90e2f925da726b50c4ed8d0fb90ad053324f31b is Tornado Cash Router in curated feed
    const result = evaluateSecurityQuery(
      "remove 0xd90e2f925da726b50c4ed8d0fb90ad053324f31b from blacklist",
      {
        walletAddress: mockWallet,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.summary).toContain("immutable curated threat feed");
    expect(result?.intent).toBeUndefined();
  });

  it("verifies address whitelist status accurately", () => {
    const resultWhitelisted = evaluateSecurityQuery(
      "is 0x3f8a0000000000000000000000000000000091b2 on my whitelist?",
      {
        walletAddress: mockWallet,
        whitelistEntries: sampleWhitelist,
      }
    );

    expect(resultWhitelisted).not.toBeNull();
    expect(resultWhitelisted?.queryType).toBe("whitelist_status");
    expect(resultWhitelisted?.summary).toContain("IS approved");

    const resultNotWhitelisted = evaluateSecurityQuery(
      "is 0x0000111122223333444455556666777788889999 whitelisted?",
      {
        walletAddress: mockWallet,
        whitelistEntries: sampleWhitelist,
      }
    );

    expect(resultNotWhitelisted).not.toBeNull();
    expect(resultNotWhitelisted?.queryType).toBe("whitelist_status");
    expect(resultNotWhitelisted?.summary).toContain("NOT currently");
  });

  it("returns whole whitelist summary", () => {
    const result = evaluateSecurityQuery("show my whitelist", {
      walletAddress: mockWallet,
      whitelistEntries: sampleWhitelist,
      whitelistConfig: { strictMode: true },
    });

    expect(result).not.toBeNull();
    expect(result?.queryType).toBe("whitelist_status");
    expect(result?.summary).toContain("1 approved entry");
    expect(result?.summary).toContain("ACTIVE");
    expect(result?.details?.some((d) => d.includes("Alice Treasury"))).toBe(true);
  });

  it("identifies curated threat address in blacklist query", () => {
    // 0x0000490b8f4ebf2ffdc1fb66bc2f210515aa0000 is Pink Drainer Sweeper
    const result = evaluateSecurityQuery(
      "is 0x0000490b8f4ebf2ffdc1fb66bc2f210515aa0000 blacklisted?",
      {
        walletAddress: mockWallet,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.queryType).toBe("threat_diagnostic");
    expect(result?.summary).toContain("IS BLACKLISTED");
    expect(result?.details?.some((d) => d.includes("Phishing"))).toBe(true);
    expect(result?.details?.some((d) => d.includes("Pink Drainer"))).toBe(true);
  });

  it("explains lookalike address poisoning in detail", () => {
    // 0x3f8a9999999999999999999999999999999991b2 is lookalike of Alice (0x3f8a...91b2)
    const result = evaluateSecurityQuery(
      "why is 0x3f8a9999999999999999999999999999999991b2 flagged?",
      {
        walletAddress: mockWallet,
        contacts: sampleContacts,
        transactionHistory: sampleHistory,
      }
    );

    expect(result).not.toBeNull();
    expect(result?.queryType).toBe("poisoning_diagnostic");
    expect(result?.summary).toContain("lookalike spoofing attack");
    expect(
      result?.details?.some((d) => d.includes("Alice Treasury") || d.includes("Impersonated Address"))
    ).toBe(true);
    expect(result?.details?.some((d) => d.includes("Attack Mechanism"))).toBe(true);
  });

  it("returns security policy overview", () => {
    const result = evaluateSecurityQuery("show my security policies", {
      walletAddress: mockWallet,
      whitelistEntries: sampleWhitelist,
      whitelistConfig: { strictMode: false },
      blacklistEntries: sampleBlacklist,
    });

    expect(result).not.toBeNull();
    expect(result?.queryType).toBe("policy_overview");
    expect(result?.summary).toContain("Privatum Security Policy Summary");
    expect(result?.details?.some((d) => d.includes("Counterparty Whitelist"))).toBe(true);
    expect(result?.details?.some((d) => d.includes("Threat Blacklist"))).toBe(true);
    expect(result?.details?.some((d) => d.includes("Address Poisoning Guard"))).toBe(true);
  });

  it("returns null for unrelated transfer intent", () => {
    const result = evaluateSecurityQuery("send 5 ETH to Alice", {
      walletAddress: mockWallet,
      contacts: sampleContacts,
    });

    expect(result).toBeNull();
  });
});
