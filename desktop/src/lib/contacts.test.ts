import { describe, it, expect, beforeEach } from "bun:test";
import {
  findContactByAddress,
  searchContacts,
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
});
