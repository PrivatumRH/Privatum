import { describe, it, expect } from "bun:test";
import {
  getAutocompleteCandidates,
  formatAddressTruncated,
  AutocompleteCandidate,
} from "./autocomplete";
import { Contact } from "./contacts";
import { AddressGuardHistoryEntry } from "./addressGuard";

describe("Recipient Autocomplete Engine", () => {
  const mockContacts: Contact[] = [
    {
      id: "contact-1",
      name: "Alice Treasury",
      address: "0x3f8a0000000000000000000000000000000091b2",
      category: "Work",
      note: "Operations payroll",
      createdAt: Date.now() - 1000000,
      lastUsedAt: Date.now() - 3600000, // 1 hour ago
    },
    {
      id: "contact-2",
      name: "Bob Cold Storage",
      address: "0x7b2200000000000000000000000000000000c418",
      category: "Cold Storage",
      note: "Hardware vault",
      createdAt: Date.now() - 2000000,
      lastUsedAt: Date.now() - 86400000 * 10, // 10 days ago
    },
    {
      id: "contact-3",
      name: "Charlie Personal",
      address: "0xaaaa00000000000000000000000000000000ffff",
      category: "Personal",
      createdAt: Date.now() - 3000000,
    },
  ];

  const mockTransactions = [
    {
      counterparty: "0x3f8a0000000000000000000000000000000091b2",
      timestamp: Date.now() - 3600000,
    },
    {
      counterparty: "0x3f8a0000000000000000000000000000000091b2",
      timestamp: Date.now() - 7200000,
    },
    {
      counterparty: "0x9999000000000000000000000000000000008888",
      timestamp: Date.now() - 5000000,
    },
    {
      counterparty: "0x9999000000000000000000000000000000008888",
      timestamp: Date.now() - 10000000,
    },
    {
      counterparty: "0x9999000000000000000000000000000000008888",
      timestamp: Date.now() - 15000000,
    },
  ];

  it("returns recent contacts and unsaved counterparties on empty query", () => {
    const candidates = getAutocompleteCandidates({
      query: "",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBeGreaterThan(0);
    // Alice should rank highest due to recent lastUsedAt
    expect(candidates[0].name).toBe("Alice Treasury");
    expect(candidates[0].isSavedContact).toBe(true);

    // Unsaved counterparty 0x9999 should also appear
    const unsaved = candidates.find(
      (c) => c.address.toLowerCase() === "0x9999000000000000000000000000000000008888"
    );
    expect(unsaved).toBeDefined();
    expect(unsaved?.name).toBe("Recent Counterparty");
    expect(unsaved?.isSavedContact).toBe(false);
    expect(unsaved?.transactionCount).toBe(3);
  });

  it("matches contact by name prefix with top score", () => {
    const candidates = getAutocompleteCandidates({
      query: "ali",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].name).toBe("Alice Treasury");
    expect(candidates[0].contactId).toBe("contact-1");
  });

  it("matches contact by substring in note", () => {
    const candidates = getAutocompleteCandidates({
      query: "payroll",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].name).toBe("Alice Treasury");
  });

  it("matches contact by category name", () => {
    const candidates = getAutocompleteCandidates({
      query: "cold",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].name).toBe("Bob Cold Storage");
  });

  it("matches address by prefix and by suffix", () => {
    // Suffix match on Alice's address
    const suffixMatches = getAutocompleteCandidates({
      query: "91b2",
      contacts: mockContacts,
      transactions: mockTransactions,
    });
    expect(suffixMatches.length).toBe(1);
    expect(suffixMatches[0].name).toBe("Alice Treasury");

    // Prefix match on Bob's address
    const prefixMatches = getAutocompleteCandidates({
      query: "0x7b22",
      contacts: mockContacts,
      transactions: mockTransactions,
    });
    expect(prefixMatches.length).toBe(1);
    expect(prefixMatches[0].name).toBe("Bob Cold Storage");
  });

  it("matches unsaved counterparty by address query", () => {
    const candidates = getAutocompleteCandidates({
      query: "8888",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].name).toBe("Recent Counterparty");
    expect(candidates[0].isSavedContact).toBe(false);
    expect(candidates[0].transactionCount).toBe(3);
  });

  it("deduplicates addresses present in both contacts and transactions", () => {
    // Alice is in mockContacts AND mockTransactions
    const candidates = getAutocompleteCandidates({
      query: "Alice",
      contacts: mockContacts,
      transactions: mockTransactions,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].name).toBe("Alice Treasury");
    expect(candidates[0].isSavedContact).toBe(true);
    expect(candidates[0].transactionCount).toBe(2);
  });

  it("filters out the user own address from suggestions", () => {
    const ownAddress = "0x3f8a0000000000000000000000000000000091b2";
    const candidates = getAutocompleteCandidates({
      query: "",
      contacts: mockContacts,
      transactions: mockTransactions,
      ownAddress,
    });

    const hasOwn = candidates.some((c) => c.address.toLowerCase() === ownAddress.toLowerCase());
    expect(hasOwn).toBe(false);
  });

  it("flags look-alike address poisoning risk on candidate", () => {
    const legitAddress = "0x111122223333444455556666777788889999aaaa";
    const poisonLookalike = "0x111100000000000000000000000000000000aaaa";

    const history: AddressGuardHistoryEntry[] = [
      {
        counterparty: legitAddress,
        type: "send",
        amount: "500",
        asset: "USDG",
      },
    ];

    const suspectContacts: Contact[] = [
      {
        id: "poison-contact",
        name: "Suspicious Lookalike",
        address: poisonLookalike,
        createdAt: Date.now(),
      },
    ];

    const candidates = getAutocompleteCandidates({
      query: "Suspicious",
      contacts: suspectContacts,
      addressHistory: history,
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].isPoisonRisk).toBe(true);
  });

  it("truncates addresses properly with formatAddressTruncated", () => {
    const formatted = formatAddressTruncated("0x3f8a0000000000000000000000000000000091b2");
    expect(formatted).toBe("0x3f8a...91b2");

    const short = formatAddressTruncated("0x12345");
    expect(short).toBe("0x12345");
  });
});
