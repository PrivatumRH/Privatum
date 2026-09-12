import { describe, it, expect } from "bun:test";
import {
  estimateUsdValue,
  get24hSpendTotal,
  evaluateSpend,
  DEFAULT_GUARDRAIL_CONFIG,
  ROLLING_WINDOW_MS,
  type SpendingRecord,
  type SpendingGuardrailConfig,
} from "./spendGuardrails";

describe("In-App Spending Guardrails", () => {
  const now = 1726128000000; // Fixed timestamp for deterministic tests

  it("accurately estimates USD value across common tokens", () => {
    expect(estimateUsdValue(100, "USDG")).toBe(100);
    expect(estimateUsdValue("50.5", "USDC")).toBe(50.5);
    expect(estimateUsdValue(0.1, "ETH")).toBe(250);
    expect(estimateUsdValue(10000, "PRIV")).toBe(50);
    expect(estimateUsdValue(0, "ETH")).toBe(0);
    expect(estimateUsdValue(-5, "USDG")).toBe(0);
  });

  it("calculates 24-hour spend total ignoring records outside window", () => {
    const records: SpendingRecord[] = [
      {
        txHash: "0x1",
        timestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
        amount: 50,
        symbol: "USDG",
        amountUsd: 50,
        recipient: "0xabc",
      },
      {
        txHash: "0x2",
        timestamp: now - 1000 * 60 * 60 * 12, // 12 hours ago
        amount: 75,
        symbol: "USDG",
        amountUsd: 75,
        recipient: "0xdef",
      },
      {
        txHash: "0x3",
        timestamp: now - ROLLING_WINDOW_MS - 5000, // 24 hours + 5s ago (expired)
        amount: 200,
        symbol: "USDG",
        amountUsd: 200,
        recipient: "0xold",
      },
    ];

    const total = get24hSpendTotal(records, now);
    expect(total).toBe(125);
  });

  it("passes when transfer is well within daily and single limits", () => {
    const config: SpendingGuardrailConfig = {
      enabled: true,
      dailyLimitUsd: 500,
      singleTxLimitUsd: 250,
      strictMode: false,
    };

    const verdict = evaluateSpend(config, 100, [], now);
    expect(verdict.allowed).toBe(true);
    expect(verdict.warning).toBe(false);
    expect(verdict.exceededDaily).toBe(false);
    expect(verdict.exceededSingleTx).toBe(false);
    expect(verdict.remainingUsd).toBe(400);
    expect(verdict.title).toBe("Within Guardrails");
  });

  it("flags single-transaction limit violation", () => {
    const config: SpendingGuardrailConfig = {
      enabled: true,
      dailyLimitUsd: 1000,
      singleTxLimitUsd: 300,
      strictMode: false,
    };

    const verdict = evaluateSpend(config, 350, [], now);
    expect(verdict.warning).toBe(true);
    expect(verdict.exceededSingleTx).toBe(true);
    expect(verdict.exceededDaily).toBe(false);
    expect(verdict.allowed).toBe(true); // Allowed with user override since strictMode is false
    expect(verdict.title).toBe("Single Transfer Cap Exceeded");
  });

  it("flags daily limit violation when cumulative spend exceeds cap", () => {
    const config: SpendingGuardrailConfig = {
      enabled: true,
      dailyLimitUsd: 500,
      singleTxLimitUsd: 400,
      strictMode: false,
    };

    const records: SpendingRecord[] = [
      {
        txHash: "0x1",
        timestamp: now - 3600000, // 1 hour ago
        amount: 300,
        symbol: "USDG",
        amountUsd: 300,
        recipient: "0x111",
      },
    ];

    const verdict = evaluateSpend(config, 250, records, now);
    expect(verdict.warning).toBe(true);
    expect(verdict.exceededDaily).toBe(true);
    expect(verdict.current24hTotalUsd).toBe(300);
    expect(verdict.projected24hTotalUsd).toBe(550);
    expect(verdict.allowed).toBe(true); // Soft mode allows override
    expect(verdict.title).toBe("Daily Limit Exceeded");
  });

  it("blocks transaction completely when strict mode is active and limits are breached", () => {
    const config: SpendingGuardrailConfig = {
      enabled: true,
      dailyLimitUsd: 500,
      singleTxLimitUsd: 250,
      strictMode: true,
    };

    const verdict = evaluateSpend(config, 300, [], now);
    expect(verdict.warning).toBe(true);
    expect(verdict.allowed).toBe(false); // Hard blocked in strict mode
  });

  it("bypasses evaluation when guardrails are disabled", () => {
    const config: SpendingGuardrailConfig = {
      enabled: false,
      dailyLimitUsd: 100,
      singleTxLimitUsd: 50,
      strictMode: true,
    };

    const verdict = evaluateSpend(config, 10000, [], now);
    expect(verdict.allowed).toBe(true);
    expect(verdict.warning).toBe(false);
    expect(verdict.title).toBe("Guardrails Disabled");
  });
});
