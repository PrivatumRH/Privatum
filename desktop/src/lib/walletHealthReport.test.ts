import { describe, it, expect } from "vitest";
import {
  generateWalletHealthReport,
  type WalletHealthReportContext,
} from "./walletHealthReport";
import { evaluateWalletHealthQuery } from "./assistant/walletHealthQueries";
import type { SpendingGuardrailConfig, SpendingRecord } from "./spendGuardrails";
import type { WhitelistEntry } from "./transferWhitelist";
import type { BlacklistEntry } from "./transferBlacklist";
import type { OfflineTransaction } from "./offlineOutbox";

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): number {
  return NOW - days * DAY;
}

const DEFAULT_CONFIG: SpendingGuardrailConfig = {
  enabled: true,
  dailyLimitUsd: 1000,
  singleTxLimitUsd: 500,
  strictMode: true,
};

describe("Wallet Health Report Engine", () => {
  it("computes an A+ grade for an optimally configured wallet", () => {
    const context: WalletHealthReportContext = {
      walletAddress: "0x1111111111111111111111111111111111111111",
      contacts: [
        {
          name: "Alice Partner",
          address: "0x2222222222222222222222222222222222222222",
          category: "Trusted",
          isFavorite: true,
          addedAt: daysAgo(30),
        },
      ],
      guardrailConfig: DEFAULT_CONFIG,
      spendingHistory: [
        {
          txHash: "0xabc",
          timestamp: daysAgo(0.5),
          amount: 50,
          symbol: "USDG",
          amountUsd: 50,
          recipient: "0x2222222222222222222222222222222222222222",
        },
      ],
      transactionHistory: [
        {
          type: "send",
          counterparty: "0x2222222222222222222222222222222222222222",
          amount: "50",
          asset: "USDG",
          timestamp: daysAgo(0.5),
          tag: "Operations",
        },
      ],
      whitelistEntries: [
        {
          address: "0x2222222222222222222222222222222222222222",
          label: "Alice Partner",
          createdAt: daysAgo(30),
        },
      ],
      whitelistConfig: { strictMode: true },
      offlineOutbox: [],
    };

    const report = generateWalletHealthReport(context);

    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.grade).toBe("A+");
    expect(report.pillars.guardrails.status).toBe("healthy");
    expect(report.pillars.security.status).toBe("healthy");
    expect(report.pillars.hygiene.status).toBe("healthy");
    expect(report.intent.type).toBe("wallet_health_report");
  });

  it("penalizes disabled guardrails", () => {
    const context: WalletHealthReportContext = {
      guardrailConfig: {
        enabled: false,
        dailyLimitUsd: 1000,
        singleTxLimitUsd: 500,
        strictMode: false,
      },
      whitelistEntries: [],
    };

    const report = generateWalletHealthReport(context);

    expect(report.pillars.guardrails.status).toBe("disabled");
    expect(report.score).toBeLessThan(80);
    expect(
      report.recommendations.some((r) => r.toLowerCase().includes("enable spending guardrails"))
    ).toBe(true);
  });

  it("flags near-limit daily guardrail consumption", () => {
    const context: WalletHealthReportContext = {
      guardrailConfig: {
        enabled: true,
        dailyLimitUsd: 500,
        singleTxLimitUsd: 500,
        strictMode: false,
      },
      spendingHistory: [
        {
          txHash: "0x123",
          timestamp: daysAgo(0.2),
          amount: 450,
          symbol: "USDG",
          amountUsd: 450,
          recipient: "0x2222222222222222222222222222222222222222",
        },
      ],
      whitelistEntries: [
        {
          address: "0x2222222222222222222222222222222222222222",
          label: "Alice",
          createdAt: daysAgo(10),
        },
      ],
    };

    const report = generateWalletHealthReport(context);

    expect(report.pillars.guardrails.status).toBe("warning");
    expect(report.pillars.guardrails.usagePercent).toBe(90);
    expect(
      report.recommendations.some((r) => r.toLowerCase().includes("80% capacity"))
    ).toBe(true);
  });

  it("flags critical security danger if counterparty matches blacklist", () => {
    const maliciousAddr = "0x0000490b8f4ebf2ffdc1fb66bc2f210515aa0000";
    const context: WalletHealthReportContext = {
      guardrailConfig: DEFAULT_CONFIG,
      transactionHistory: [
        {
          type: "send",
          counterparty: maliciousAddr,
          amount: "100",
          asset: "USDG",
          timestamp: daysAgo(1),
          tag: "Other",
        },
      ],
      blacklistEntries: [
        {
          address: maliciousAddr,
          name: "Phishing Drainer",
          category: "Phishing",
          reason: "Confirmed drainer contract",
          source: "user",
          addedAt: daysAgo(2),
        },
      ],
    };

    const report = generateWalletHealthReport(context);

    expect(report.pillars.security.status).toBe("danger");
    expect(report.score).toBeLessThanOrEqual(70);
    expect(
      report.recommendations.some((r) => r.toLowerCase().includes("audit past recipient addresses"))
    ).toBe(true);
  });

  it("penalizes failed offline outbox transactions in hygiene pillar", () => {
    const context: WalletHealthReportContext = {
      guardrailConfig: DEFAULT_CONFIG,
      offlineOutbox: [
        {
          id: "tx-1",
          rawTx: "0x01",
          serializedTx: "0x01",
          txHash: "0xhash1",
          recipient: "0x2222222222222222222222222222222222222222",
          amount: "10",
          asset: "USDG",
          nonce: 1,
          createdAt: daysAgo(1),
          status: "failed",
          retryCount: 3,
          lastError: "Replacement transaction underpriced",
        } as OfflineTransaction,
      ],
    };

    const report = generateWalletHealthReport(context);

    expect(report.pillars.hygiene.status).toBe("needs_attention");
    expect(
      report.recommendations.some((r) => r.toLowerCase().includes("failed transaction"))
    ).toBe(true);
  });
});

describe("Wallet Health NLP Query Evaluator", () => {
  const context: WalletHealthReportContext = {
    guardrailConfig: DEFAULT_CONFIG,
    whitelistEntries: [
      {
        address: "0x2222222222222222222222222222222222222222",
        label: "Alice",
        createdAt: daysAgo(5),
      },
    ],
  };

  it("evaluates 'wallet health report'", () => {
    const res = evaluateWalletHealthQuery("wallet health report", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.summary).toContain("Wallet Health Audit:");
    expect(res?.intent?.type).toBe("wallet_health_report");
  });

  it("evaluates 'give me a full wallet health report'", () => {
    const res = evaluateWalletHealthQuery("give me a full wallet health report", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
    expect(res?.intent?.grade).toBeDefined();
  });

  it("evaluates 'audit my wallet'", () => {
    const res = evaluateWalletHealthQuery("audit my wallet", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
  });

  it("evaluates 'financial health check'", () => {
    const res = evaluateWalletHealthQuery("financial health check", context);
    expect(res).not.toBeNull();
    expect(res?.handled).toBe(true);
  });

  it("returns null for unrelated prompts", () => {
    const res = evaluateWalletHealthQuery("send 10 USDG to Alice", context);
    expect(res).toBeNull();
  });
});
