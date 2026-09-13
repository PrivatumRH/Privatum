import { describe, it, expect, beforeEach } from "bun:test";
import {
  findContactByAddress,
  searchContacts,
  getRecentContacts,
  getStarredContacts,
  toggleStarContact,
  saveContacts,
  loadContacts,
  type Contact,
} from "./contacts";

describe("Private Address Book & Local Contacts", () => {
  const sampleContacts: Contact[] = [
    {
      id: "c1",
      name: "Alice Payroll",
      address: "0x1111111111111111111111111111111111111111",
      category: "Work",
      note: "Monthly compensation",
      createdAt: 1000,
    },
    {
      id: "c2",
      name: "Bob Cold Storage",
      address: "0x2222222222222222222222222222222222222222",
      category: "Cold Storage",
      note: "Hardware vault",
      createdAt: 2000,
    },
    {
      id: "c3",
      name: "Kraken Robinhood Gateway",
      address: "0x3333333333333333333333333333333333333333",
      category: "Exchange",
      createdAt: 3000,
    },
  ];

  it("finds contact by address case-insensitively", () => {
    const found = findContactByAddress(
      sampleContacts,
      "0x1111111111111111111111111111111111111111".toLowerCase()
    );
    expect(found).toBeDefined();
    expect(found?.name).toBe("Alice Payroll");

    const upper = findContactByAddress(
      sampleContacts,
      "0x2222222222222222222222222222222222222222".toUpperCase()
    );
    expect(upper).toBeDefined();
    expect(upper?.name).toBe("Bob Cold Storage");

    const unknown = findContactByAddress(sampleContacts, "0x9999999999999999999999999999999999999999");
    expect(unknown).toBeUndefined();
  });

  it("searches contacts by name, address fragment, and note", () => {
    const byName = searchContacts(sampleContacts, "alice");
    expect(byName.length).toBe(1);
    expect(byName[0].name).toBe("Alice Payroll");

    const byNote = searchContacts(sampleContacts, "hardware");
    expect(byNote.length).toBe(1);
    expect(byNote[0].name).toBe("Bob Cold Storage");

    const byAddr = searchContacts(sampleContacts, "3333");
    expect(byAddr.length).toBe(1);
    expect(byAddr[0].name).toBe("Kraken Robinhood Gateway");
  });

  it("filters contacts by category", () => {
    const work = searchContacts(sampleContacts, "", "Work");
    expect(work.length).toBe(1);
    expect(work[0].name).toBe("Alice Payroll");

    const all = searchContacts(sampleContacts, "", "All");
    expect(all.length).toBe(3);

    const emptyFilter = searchContacts(sampleContacts, "kraken", "Exchange");
    expect(emptyFilter.length).toBe(1);

    const mismatchFilter = searchContacts(sampleContacts, "kraken", "Personal");
    expect(mismatchFilter.length).toBe(0);
  });

  it("returns recently used contacts newest first", () => {
    const used: Contact[] = [
      { ...sampleContacts[0], lastUsedAt: 500 },
      { ...sampleContacts[1], lastUsedAt: 900 },
      { ...sampleContacts[2], lastUsedAt: 700 },
    ];
    const recent = getRecentContacts(used);
    expect(recent.map((c) => c.id)).toEqual(["c2", "c3", "c1"]);
  });

  it("excludes contacts that have never been used", () => {
    const mixed: Contact[] = [
      { ...sampleContacts[0], lastUsedAt: 500 },
      sampleContacts[1],
      sampleContacts[2],
    ];
    const recent = getRecentContacts(mixed);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("c1");
  });

  it("caps the recent contacts strip at the requested limit", () => {
    const used = sampleContacts.map((c, i) => ({ ...c, lastUsedAt: 100 + i }));
    expect(getRecentContacts(used, 2)).toHaveLength(2);
  });

  it("extracts starred contacts for quick-pay shelf", () => {
    const mixed: Contact[] = [
      { ...sampleContacts[0], isStarred: true },
      { ...sampleContacts[1], isStarred: false },
      { ...sampleContacts[2], isStarred: true },
    ];
    const starred = getStarredContacts(mixed);
    expect(starred).toHaveLength(2);
    expect(starred.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("filters contacts by Starred category tab", () => {
    const mixed: Contact[] = [
      { ...sampleContacts[0], isStarred: true },
      { ...sampleContacts[1], isStarred: false },
      { ...sampleContacts[2], isStarred: true },
    ];
    const starredAll = searchContacts(mixed, "", "Starred");
    expect(starredAll).toHaveLength(2);
    expect(starredAll.map((c) => c.name)).toEqual(["Alice Payroll", "Kraken Robinhood Gateway"]);

    const queryMatch = searchContacts(mixed, "alice", "Starred");
    expect(queryMatch).toHaveLength(1);
    expect(queryMatch[0].name).toBe("Alice Payroll");

    const unstarredMatch = searchContacts(mixed, "bob", "Starred");
    expect(unstarredMatch).toHaveLength(0);
  });

  it("toggles star status cleanly", () => {
    const memoryStore: Record<string, string> = {};
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, val: string) => {
        memoryStore[key] = val;
      },
      removeItem: (key: string) => {
        delete memoryStore[key];
      },
    };

    const wallet = "0x1234567890123456789012345678901234567890";
    saveContacts(wallet, sampleContacts);

    // Initial state: not starred
    let loaded = loadContacts(wallet);
    expect(Boolean(loaded[0].isStarred)).toBe(false);

    // Toggle star on c1
    const updated = toggleStarContact(wallet, "c1");
    expect(updated[0].isStarred).toBe(true);
    expect(loadContacts(wallet)[0].isStarred).toBe(true);

    // Toggle star off on c1
    const unstarred = toggleStarContact(wallet, "c1");
    expect(unstarred[0].isStarred).toBe(false);
    expect(loadContacts(wallet)[0].isStarred).toBe(false);
  });
});
