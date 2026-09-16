import { describe, it, expect } from "bun:test";
import { evaluateTransactionRisk } from "./riskScore";
import type { AddressGuardVerdict } from "./addressGuard";
import type { GuardrailVerdict } from "./spendGuardrails";
import type { Contact } from "./contacts";

describe("Transaction Risk Scoring Engine", () => {
  const mockContact: Contact = {
    id: "c1",
    name: "Alice",
    address: "0x1111111111111111111111111111111111111111",
    category: "personal",
    createdAt: 1000,
  };

  it("evaluates known contact with clean checks as Low Risk", () => {
    const result = evaluateTransactionRisk({
      recipient: "0x1111111111111111111111111111111111111111",
      contacts: [mockContact],
      transactions: [],
      addressVerdict: { level: "known", title: "Known Address", detail: "In contacts" },
      guardrailVerdict: {
        allowed: true,
        warning: false,
        message: "Within caps",
        title: "Limits Normal",
        dailyLimitUsd: 1000,
        singleTxLimitUsd: 500,
        current24hTotalUsd: 50,
        projected24hTotalUsd: 100,
      },
      simulationReverted: false,
    });

    expect(result.level).toBe("low");
    expect(result.label).toBe("Low Risk");
    expect(result.color).toBe("#22c55e");
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(4);
    expect(result.factors.every((f) => f.status === "pass")).toBe(true);
  });

  it("evaluates previous counterparty in history as Low Risk", () => {
    const prevAddr = "0x2222222222222222222222222222222222222222";
    const result = evaluateTransactionRisk({
      recipient: prevAddr,
      contacts: [],
      transactions: [{ type: "send", counterparty: prevAddr }],
      simulationReverted: false,
    });

    expect(result.level).toBe("low");
    expect(result.factors.find((f) => f.id === "recipient_history")?.status).toBe("pass");
  });

  it("evaluates stealth transfer as passing recipient history check", () => {
    const result = evaluateTransactionRisk({
      recipient: "st:eth:0x3333333333333333333333333333333333333333",
      isStealth: true,
      simulationReverted: false,
    });

    expect(result.level).toBe("low");
    expect(result.factors.find((f) => f.id === "recipient_history")?.name).toBe("Stealth Address");
  });

  it("evaluates first-time recipient with guardrail warning as Medium Risk", () => {
    const newAddr = "0x4444444444444444444444444444444444444444";
    const warningGuardrail: GuardrailVerdict = {
      allowed: true,
      warning: true,
      title: "Approaching Limit",
      message: "Transfer reaches 85% of daily cap.",
      dailyLimitUsd: 500,
      singleTxLimitUsd: 500,
      current24hTotalUsd: 350,
      projected24hTotalUsd: 450,
    };

    const result = evaluateTransactionRisk({
      recipient: newAddr,
      contacts: [],
      transactions: [],
      guardrailVerdict: warningGuardrail,
      simulationReverted: false,
    });

    expect(result.level).toBe("medium");
    expect(result.label).toBe("Medium Risk");
    expect(result.color).toBe("#f59e0b");
    expect(result.score).toBe(35); // 15 (first-time) + 20 (guardrail warn)
  });

  it("evaluates address poisoning look-alike danger as High Risk", () => {
    const dangerVerdict: AddressGuardVerdict = {
      level: "danger",
      title: "Address Poisoning Detected",
      detail: "Shares 4 prefix and 4 suffix characters with your recent counterparty.",
      lookalikeOf: "0x5555555555555555555555555555555555555555",
      prefixMatch: 4,
      suffixMatch: 4,
    };

    const result = evaluateTransactionRisk({
      recipient: "0x5555000000000000000000000000000000005555",
      addressVerdict: dangerVerdict,
      simulationReverted: false,
    });

    expect(result.level).toBe("high");
    expect(result.label).toBe("High Risk");
    expect(result.color).toBe("#f64943");
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("evaluates strict-mode guardrail limit breach as High Risk", () => {
    const blockedGuardrail: GuardrailVerdict = {
      allowed: false,
      warning: true,
      title: "Limit Exceeded",
      message: "Daily limit exceeded.",
      dailyLimitUsd: 100,
      singleTxLimitUsd: 100,
      current24hTotalUsd: 80,
      projected24hTotalUsd: 150,
    };

    const result = evaluateTransactionRisk({
      recipient: "0x6666666666666666666666666666666666666666",
      guardrailVerdict: blockedGuardrail,
      simulationReverted: false,
    });

    expect(result.level).toBe("high");
    expect(result.score).toBe(55); // 15 (first-time) + 40 (blocked)
  });

  it("evaluates simulation revert as High Risk", () => {
    const result = evaluateTransactionRisk({
      recipient: "0x7777777777777777777777777777777777777777",
      simulationReverted: true,
      addressVerdict: { level: "warning", title: "Warning", detail: "Unrecognized address" },
    });

    expect(result.level).toBe("high");
    expect(result.score).toBe(75); // 15 (first-time) + 25 (warn) + 35 (revert)
  });

  it("evaluates blacklisted destination as Critical 100 Risk immediately", () => {
    const result = evaluateTransactionRisk({
      recipient: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
      blacklistVerdict: {
        isBlacklisted: true,
        entry: {
          address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b",
          name: "Tornado Cash Router",
          reason: "Sanctioned mixer contract",
          category: "Sanctioned",
          addedAt: 1700000000000,
          source: "curated",
        },
      },
    });

    expect(result.level).toBe("high");
    expect(result.score).toBe(100);
    expect(result.label).toContain("Critical Risk");
    expect(result.factors.some((f) => f.id === "transfer_blacklist" && f.status === "fail")).toBe(true);
    expect(result.summary).toContain("strictly blocked");
  });

  it("escalates risk score when clipboard sanitizer detects clipper tampering", () => {
    const result = evaluateTransactionRisk({
      recipient: "0x532f99999999999999999999999999999999e456",
      clipboardVerdict: {
        isCompromised: true,
        issueType: "clipper_tamper",
        severity: "danger",
        title: "Potential Clipboard Hijacker Detected",
        message: "Malware may have swapped your clipboard destination.",
        cleanedAddress: "0x532f99999999999999999999999999999999e456",
        originalRaw: "0x532f99999999999999999999999999999999e456",
        strippedCount: 0,
      },
    });

    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(65); // 15 (first-time) + 50 (clipboard fail)
    expect(result.factors.some((f) => f.id === "clipboard_sanitizer" && f.status === "fail")).toBe(true);
  });
});
