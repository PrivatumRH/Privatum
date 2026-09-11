import { describe, expect, it } from "bun:test";
import {
  checkAddressPoisoning,
  commonPrefixLength,
  commonSuffixLength,
  requiresAcknowledgement,
  type AddressGuardHistoryEntry,
} from "./addressGuard";

const REAL = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
// Same first 4 and last 4 hex chars as REAL, different middle: 0x + 4 + 32 + 4.
const POISONED = "0x742d" + "0".repeat(32) + "f44e";
const UNRELATED = "0x9f8B2c17A4E5D6039182736455aBcDef01234567";
const OWN = "0x1111111111111111111111111111111111111111";

function sends(...addrs: string[]): AddressGuardHistoryEntry[] {
  return addrs.map((a) => ({ type: "send" as const, counterparty: a, amount: "10", asset: "USDG" }));
}

describe("character matching", () => {
  it("ignores the 0x prefix and casing", () => {
    expect(commonPrefixLength("0xABCD11", "0xabcd99")).toBe(4);
    expect(commonSuffixLength("0x11abcd", "0x99ABCD")).toBe(4);
  });
});

describe("checkAddressPoisoning", () => {
  it("flags a look-alike as danger and names the impersonated address", () => {
    const v = checkAddressPoisoning({ recipient: POISONED, history: sends(REAL), ownAddresses: [] });
    expect(v.level).toBe("danger");
    expect(v.lookalikeOf).toBe(REAL.toLowerCase());
    expect(requiresAcknowledgement(v)).toBe(true);
  });

  it("trusts an exact repeat of an address already paid", () => {
    const v = checkAddressPoisoning({ recipient: REAL, history: sends(REAL), ownAddresses: [] });
    expect(v.level).toBe("known");
    expect(requiresAcknowledgement(v)).toBe(false);
  });

  it("recognises the user's own account", () => {
    const v = checkAddressPoisoning({ recipient: OWN, history: [], ownAddresses: [OWN] });
    expect(v.level).toBe("known");
  });

  it("passes an unrelated new address", () => {
    const v = checkAddressPoisoning({ recipient: UNRELATED, history: sends(REAL), ownAddresses: [] });
    expect(v.level).toBe("ok");
  });

  it("does not trust an address just because it sent you dust", () => {
    const history: AddressGuardHistoryEntry[] = [
      { type: "receive", counterparty: POISONED, amount: "0.000001", asset: "USDG" },
    ];
    const v = checkAddressPoisoning({ recipient: POISONED, history, ownAddresses: [] });
    expect(v.level).toBe("danger");
  });

  it("clears an address that sent a real payment", () => {
    const history: AddressGuardHistoryEntry[] = [
      { type: "receive", counterparty: UNRELATED, amount: "250", asset: "USDG" },
    ];
    const v = checkAddressPoisoning({ recipient: UNRELATED, history, ownAddresses: [] });
    expect(v.level).toBe("ok");
  });

  it("ignores stealth history rows that are not full addresses", () => {
    const history: AddressGuardHistoryEntry[] = [
      { type: "send", counterparty: "(Stealth) 0x742d...f44e", amount: "10", asset: "ETH" },
    ];
    const v = checkAddressPoisoning({ recipient: POISONED, history, ownAddresses: [] });
    expect(v.level).toBe("ok");
  });

  it("skips meta-addresses and malformed input", () => {
    const v = checkAddressPoisoning({ recipient: "st:eth:0xabc", history: sends(REAL), ownAddresses: [] });
    expect(v.level).toBe("ok");
  });
});
