import { describe, expect, it } from "bun:test";
import { auditPrivacy } from "./privacyAuditor";

describe("Stealth Address Leakage & Unlinkability Auditor", () => {
  it("scores a fresh stealth meta-address as strongly unlinkable", () => {
    const audit = auditPrivacy({ recipient: `st:eth:0x${"a".repeat(132)}`, amount: "7.123", asset: "ETH", isStealthSend: true, transactions: [] });
    expect(audit.score).toBeGreaterThanOrEqual(80);
    expect(audit.label).toBe("Strong Unlinkability");
  });
  it("flags direct recipient reuse, amount fingerprints, and rapid timing", () => {
    const now = 1_000_000;
    const audit = auditPrivacy({ recipient: "0x1111111111111111111111111111111111111111", amount: "10", asset: "USDG", isStealthSend: false, now, transactions: [{ type: "send", counterparty: "0x1111111111111111111111111111111111111111", amount: "10", asset: "USDG", timestamp: now - 60_000 }] });
    expect(audit.score).toBeLessThan(20);
    expect(audit.findings.map((finding) => finding.id)).toContain("recipient_reuse");
    expect(audit.findings.map((finding) => finding.id)).toContain("amount_fingerprint");
  });
});
