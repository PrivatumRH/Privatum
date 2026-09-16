import { describe, it, expect, beforeEach } from "bun:test";
import {
  stripHiddenUnicode,
  recordCopiedAddress,
  getRecentCopiedAddress,
  clearCopiedAddressHistory,
  computeCommonPrefix,
  computeCommonSuffix,
  inspectPastedAddress,
  KnownReference,
} from "./clipboardSanitizer";

describe("stripHiddenUnicode", () => {
  it("removes zero-width spaces and BOMs", () => {
    const dirty = "0x1234\u200B5678\uFEFF9012\u200C3456\u200D7890\u20601234";
    const { cleaned, strippedCount, removedTypes } = stripHiddenUnicode(dirty);
    expect(cleaned).toBe("0x123456789012345678901234");
    expect(strippedCount).toBe(5);
    expect(removedTypes).toContain("zero-width-space");
  });

  it("removes right-to-left and bidirectional override characters", () => {
    const dirty = "0x1234\u202E5678\u202D9012";
    const { cleaned, strippedCount, removedTypes } = stripHiddenUnicode(dirty);
    expect(cleaned).toBe("0x123456789012");
    expect(strippedCount).toBe(2);
    expect(removedTypes).toContain("bidi-override");
  });

  it("removes soft hyphens and normalizes unicode spaces", () => {
    const dirty = " 0x1234\u00AD5678\u00A09012 ";
    const { cleaned, strippedCount } = stripHiddenUnicode(dirty);
    expect(cleaned).toBe("0x12345678 9012");
    expect(strippedCount).toBe(2);
  });

  it("leaves clean strings untouched", () => {
    const clean = "0x532f27101cd45140843689c56bad6118c709e456";
    const { cleaned, strippedCount } = stripHiddenUnicode(clean);
    expect(cleaned).toBe(clean);
    expect(strippedCount).toBe(0);
  });
});

describe("computeCommonPrefix and computeCommonSuffix", () => {
  it("computes prefix matching characters excluding 0x", () => {
    const a = "0x1234abcd5678";
    const b = "0x1234ffff5678";
    expect(computeCommonPrefix(a, b)).toBe(4);
  });

  it("computes suffix matching characters", () => {
    const a = "0x1234abcd5678";
    const b = "0x9999abcd5678";
    expect(computeCommonSuffix(a, b)).toBe(8);
  });
});

describe("In-app Copied Address Tracker", () => {
  beforeEach(() => {
    clearCopiedAddressHistory();
  });

  it("records and retrieves copied addresses within freshness window", () => {
    const address = "0x532f27101cd45140843689c56bad6118c709e456";
    recordCopiedAddress(address, "Treasury Vault");

    const recent = getRecentCopiedAddress(10000);
    expect(recent).not.toBeNull();
    expect(recent?.address).toBe(address.toLowerCase());
    expect(recent?.label).toBe("Treasury Vault");
  });

  it("ignores non-EVM addresses", () => {
    recordCopiedAddress("not-an-address", "Bad");
    expect(getRecentCopiedAddress()).toBeNull();
  });

  it("expires after specified maxAgeMs", () => {
    const address = "0x532f27101cd45140843689c56bad6118c709e456";
    recordCopiedAddress(address);

    const expired = getRecentCopiedAddress(-1);
    expect(expired).toBeNull();
  });
});

describe("inspectPastedAddress", () => {
  const GENUINE = "0x532f27101cd45140843689c56bad6118c709e456";
  // Shares 0x532f... and ...e456 but has attacker middle
  const CLIPPER_SWAP = "0x532f99999999999999999999999999999999e456";
  const UNRELATED = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    clearCopiedAddressHistory();
  });

  it("detects clipper tamper when pasted address mimics copied address", () => {
    recordCopiedAddress(GENUINE, "Staking Vault");

    const verdict = inspectPastedAddress({
      rawInput: CLIPPER_SWAP,
    });

    expect(verdict.isCompromised).toBe(true);
    expect(verdict.issueType).toBe("clipper_tamper");
    expect(verdict.severity).toBe("danger");
    expect(verdict.divergence).toBeDefined();
    expect(verdict.divergence?.intendedAddress).toBe(GENUINE);
    expect(verdict.divergence?.intendedLabel).toBe("Staking Vault");
    expect(verdict.divergence?.prefixMatch).toBeGreaterThanOrEqual(4);
    expect(verdict.divergence?.suffixMatch).toBeGreaterThanOrEqual(4);
  });

  it("warns about clipboard mismatch if address is completely different within 60s", () => {
    recordCopiedAddress(GENUINE, "Operations");

    const verdict = inspectPastedAddress({
      rawInput: UNRELATED,
    });

    expect(verdict.isCompromised).toBe(false);
    expect(verdict.issueType).toBe("clipboard_mismatch");
    expect(verdict.severity).toBe("warning");
    expect(verdict.divergence?.intendedAddress).toBe(GENUINE);
  });

  it("detects lookalike poisoning against approved whitelist entries", () => {
    const whitelist: KnownReference[] = [
      {
        address: GENUINE,
        label: "Approved Relayer",
        source: "whitelist",
      },
    ];

    const verdict = inspectPastedAddress({
      rawInput: CLIPPER_SWAP,
      knownReferences: whitelist,
    });

    expect(verdict.isCompromised).toBe(true);
    expect(verdict.issueType).toBe("lookalike_poison");
    expect(verdict.severity).toBe("danger");
    expect(verdict.title).toContain("Approved Whitelist");
    expect(verdict.divergence?.intendedLabel).toBe("Approved Relayer");
  });

  it("detects lookalike poisoning against saved contacts", () => {
    const contacts: KnownReference[] = [
      {
        address: GENUINE,
        label: "Bob Accounting",
        source: "contact",
        isStarred: true,
      },
    ];

    const verdict = inspectPastedAddress({
      rawInput: CLIPPER_SWAP,
      knownReferences: contacts,
    });

    expect(verdict.isCompromised).toBe(true);
    expect(verdict.issueType).toBe("lookalike_poison");
    expect(verdict.severity).toBe("danger");
    expect(verdict.title).toContain("Saved Contact");
  });

  it("passes exact match to contacts or whitelist as clean", () => {
    const references: KnownReference[] = [
      {
        address: GENUINE,
        label: "Bob Accounting",
        source: "contact",
      },
    ];

    const verdict = inspectPastedAddress({
      rawInput: GENUINE,
      knownReferences: references,
    });

    expect(verdict.isCompromised).toBe(false);
    expect(verdict.issueType).toBe("none");
    expect(verdict.severity).toBe("clean");
  });

  it("cleans zero-width characters and returns info severity when no lookalike", () => {
    const dirty = `${UNRELATED.slice(0, 10)}\u200B${UNRELATED.slice(10)}`;

    const verdict = inspectPastedAddress({
      rawInput: dirty,
    });

    expect(verdict.isCompromised).toBe(false);
    expect(verdict.issueType).toBe("invisible_unicode");
    expect(verdict.severity).toBe("info");
    expect(verdict.cleanedAddress).toBe(UNRELATED);
    expect(verdict.strippedCount).toBe(1);
  });
});
