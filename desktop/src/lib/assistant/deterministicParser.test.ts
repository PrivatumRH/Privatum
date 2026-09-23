import { describe, it, expect } from "bun:test";
import { parseDeterministicIntent } from "./deterministicParser";
import type { Contact } from "../contacts";

describe("Deterministic NLP Parser", () => {
  const mockContacts: Contact[] = [
    {
      id: "c-1",
      name: "Alice",
      address: "0x1111111111111111111111111111111111111111",
      category: "Personal",
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: "c-2",
      name: "Bob Work",
      address: "0x2222222222222222222222222222222222222222",
      category: "Work",
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it("parses send with raw 0x address", () => {
    const raw = "send 15.5 USDG to 0x3c204d1697b85d2a7e1d79459d619a852d11e0dc";
    const res = parseDeterministicIntent(raw, mockContacts);
    expect(res).not.toBeNull();
    if (res && res.type === "send_transfer") {
      expect(res.amount).toBe("15.5");
      expect(res.asset).toBe("USDG");
      expect(res.recipient.toLowerCase()).toBe("0x3c204d1697b85d2a7e1d79459d619a852d11e0dc".toLowerCase());
      expect(res.isStealth).toBe(false);
    }
  });

  it("recognizes an RWA buy command without downgrading it to USDG", () => {
    const res = parseDeterministicIntent("buy 25 AAPL", mockContacts);
    expect(res?.type).toBe("rwa_command");
    if (res?.type === "rwa_command") {
      expect(res.tokenSymbol).toBe("AAPL");
      expect(res.tokenName).toBe("Apple Inc.");
      expect(res.amount).toBe("25");
      expect(res.fundingAsset).toBe("USDG");
      expect(res.requiresExplicitConfirmation).toBe(true);
    }
  });

  it("recognizes an RWA swap with explicit funding asset", () => {
    const res = parseDeterministicIntent("swap 0.5 ETH for TSLA", mockContacts);
    expect(res?.type).toBe("rwa_command");
    if (res?.type === "rwa_command") {
      expect(res.tokenSymbol).toBe("TSLA");
      expect(res.fundingAsset).toBe("ETH");
      expect(res.action).toBe("swap");
    }
  });

  it("resolves contact name and recognizes stealth mode", () => {
    const raw = "transfer 0.25 ETH to Alice secretly with stealth";
    const res = parseDeterministicIntent(raw, mockContacts);
    expect(res).not.toBeNull();
    if (res && res.type === "send_transfer") {
      expect(res.amount).toBe("0.25");
      expect(res.asset).toBe("ETH");
      expect(res.recipient.toLowerCase()).toBe("0x1111111111111111111111111111111111111111".toLowerCase());
      expect(res.recipientName).toBe("Alice");
      expect(res.isStealth).toBe(true);
    }
  });

  it("parses paylink generation", () => {
    const raw = "generate paylink for 45 USDG memo coffee with team";
    const res = parseDeterministicIntent(raw, mockContacts);
    expect(res).not.toBeNull();
    if (res && res.type === "create_paylink") {
      expect(res.amount).toBe("45");
      expect(res.asset).toBe("USDG");
      expect(res.memo).toContain("coffee");
    }
  });

  it("parses panic freeze intent", () => {
    const res24 = parseDeterministicIntent("freeze my wallet for 24h", mockContacts);
    expect(res24?.type).toBe("panic_freeze");
    if (res24?.type === "panic_freeze") {
      expect(res24.hours).toBe(24);
    }

    const resPerm = parseDeterministicIntent("lock wallet until I unlock", mockContacts);
    if (resPerm?.type === "panic_freeze") {
      expect(resPerm.hours).toBeNull();
    }
  });

  it("parses unfreeze with 6-digit code", () => {
    const res = parseDeterministicIntent("unfreeze wallet 482910", mockContacts);
    expect(res?.type).toBe("unfreeze_wallet");
    if (res?.type === "unfreeze_wallet") {
      expect(res.code).toBe("482910");
    }
  });

  it("parses address inspection intent", () => {
    const res = parseDeterministicIntent("check address 0x3c204d1697b85d2a7e1d79459d619a852d11e0dc", mockContacts);
    expect(res?.type).toBe("check_address");
  });

  it("parses export ledger intent", () => {
    const res = parseDeterministicIntent("export my transaction history to csv", mockContacts);
    expect(res?.type).toBe("export_ledger");

    const res2 = parseDeterministicIntent("download ledger", mockContacts);
    expect(res2?.type).toBe("export_ledger");
  });
});
