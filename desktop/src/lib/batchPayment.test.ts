import { describe, it, expect } from "vitest";
import {
  parseBatchPaymentPrompt,
  evaluateBatchPreflight,
  type BatchPaymentContext,
} from "./batchPayment";
import { evaluateBatchPaymentQuery } from "./assistant/batchPaymentQueries";
import type { Contact } from "./contacts";

const CONTACTS: Contact[] = [
  {
    name: "Alice Partner",
    address: "0x1111111111111111111111111111111111111111",
    category: "Trusted",
    isFavorite: true,
    addedAt: Date.now() - 100000,
  },
  {
    name: "Bob Contractor",
    address: "0x2222222222222222222222222222222222222222",
    category: "Vendor",
    addedAt: Date.now() - 50000,
  },
  {
    name: "Charlie Dev",
    address: "0x3333333333333333333333333333333333333333",
    category: "Vendor",
    addedAt: Date.now() - 20000,
  },
];

describe("Pre-Flight Batch & Multi-Pay Scheduling Engine", () => {
  describe("parseBatchPaymentPrompt", () => {
    it("parses explicit batch with 'batch send 100 USDG to Alice, 250 USDG to Bob, and 50 USDG to Charlie'", () => {
      const parsed = parseBatchPaymentPrompt(
        "batch send 100 USDG to Alice, 250 USDG to Bob, and 50 USDG to Charlie",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.items.length).toBe(3);
      expect(parsed?.items[0].recipientName).toBe("Alice Partner");
      expect(parsed?.items[0].amount).toBe("100");
      expect(parsed?.items[0].asset).toBe("USDG");
      expect(parsed?.items[1].recipientName).toBe("Bob Contractor");
      expect(parsed?.items[1].amount).toBe("250");
      expect(parsed?.items[2].recipientName).toBe("Charlie Dev");
      expect(parsed?.items[2].amount).toBe("50");
      expect(parsed?.isScheduled).toBe(false);
    });

    it("parses coordinate send clauses 'pay 50 USDG to Alice and 100 USDG to Bob'", () => {
      const parsed = parseBatchPaymentPrompt(
        "pay 50 USDG to Alice and 100 USDG to Bob",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.items.length).toBe(2);
      expect(parsed?.items[0].recipientName).toBe("Alice Partner");
      expect(parsed?.items[0].amount).toBe("50");
      expect(parsed?.items[1].recipientName).toBe("Bob Contractor");
      expect(parsed?.items[1].amount).toBe("100");
    });

    it("parses tags in clauses 'batch pay 150 USDG to Alice (Payroll) and 80 USDG to Bob (Vendor)'", () => {
      const parsed = parseBatchPaymentPrompt(
        "batch pay 150 USDG to Alice (Payroll) and 80 USDG to Bob (Vendor)",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.items.length).toBe(2);
      expect(parsed?.items[0].tag).toBe("Payroll");
      expect(parsed?.items[1].tag).toBe("Vendor");
    });

    it("parses scheduling modifier 'schedule batch payment: 100 USDG to Alice and 200 USDG to Bob tomorrow'", () => {
      const parsed = parseBatchPaymentPrompt(
        "schedule batch payment: 100 USDG to Alice and 200 USDG to Bob tomorrow",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.isScheduled).toBe(true);
      expect(parsed?.scheduledDelay).toBe("Tomorrow at 09:00 UTC");
      expect(parsed?.items.length).toBe(2);
    });

    it("parses stealth flag 'batch stealth send 20 USDG to Alice and 40 USDG to Bob'", () => {
      const parsed = parseBatchPaymentPrompt(
        "batch stealth send 20 USDG to Alice and 40 USDG to Bob",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.items[0].isStealth).toBe(true);
      expect(parsed?.items[1].isStealth).toBe(true);
    });

    it("parses raw hex recipient addresses", () => {
      const parsed = parseBatchPaymentPrompt(
        "batch transfer 10 USDG to 0x4444444444444444444444444444444444444444 and 20 USDG to 0x5555555555555555555555555555555555555555",
        CONTACTS
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.items.length).toBe(2);
      expect(parsed?.items[0].recipient).toBe("0x4444444444444444444444444444444444444444");
      expect(parsed?.items[1].recipient).toBe("0x5555555555555555555555555555555555555555");
    });

    it("returns null for single transfer prompts", () => {
      const parsed = parseBatchPaymentPrompt(
        "send 100 USDG to Alice",
        CONTACTS
      );
      expect(parsed).toBeNull();
    });
  });

  describe("evaluateBatchPreflight", () => {
    it("computes aggregated totals and estimated gas savings", () => {
      const batch = {
        items: [
          { recipient: "0x1111", amount: "150", asset: "USDG" as const },
          { recipient: "0x2222", amount: "250", asset: "USDG" as const },
          { recipient: "0x3333", amount: "0.5", asset: "ETH" as const },
        ],
        isScheduled: false,
      };

      const result = evaluateBatchPreflight(batch);
      expect(result.totalAmounts["USDG"]).toBe(400);
      expect(result.totalAmounts["ETH"]).toBe(0.5);
      expect(result.itemCount).toBe(3);
      expect(result.estimatedGasSavingsPercent).toBeGreaterThan(30);
      expect(result.allChecksPassed).toBe(true);
    });

    it("detects guardrail violations when batch exceeds daily limit", () => {
      const batch = {
        items: [
          { recipient: "0x1111", amount: "600", asset: "USDG" as const },
          { recipient: "0x2222", amount: "500", asset: "USDG" as const },
        ],
        isScheduled: false,
      };

      const ctx: BatchPaymentContext = {
        guardrailConfig: {
          dailyLimitUsd: 1000,
          singleTxLimitUsd: 2000,
          strictMode: false,
          enabled: true,
        },
        spendingHistory: [
          {
            txHash: "0xabc",
            symbol: "USDG",
            amount: 200,
            amountUsd: 200,
            recipient: "0x9999",
            timestamp: Date.now() - 1000 * 60 * 60,
          },
        ],
      };

      const result = evaluateBatchPreflight(batch, ctx);
      const guardrailCheck = result.checks.find((c) => c.id === "guardrails");
      expect(guardrailCheck?.status).toBe("warn");
      expect(guardrailCheck?.message).toContain("exceeds daily ceiling");
    });

    it("detects blacklisted recipients in batch", () => {
      const batch = {
        items: [
          { recipient: "0x1111111111111111111111111111111111111111", amount: "50", asset: "USDG" as const },
          { recipient: "0xbadbadbadbadbadbadbadbadbadbadbadbadbad0", amount: "100", asset: "USDG" as const },
        ],
        isScheduled: false,
      };

      const ctx: BatchPaymentContext = {
        blacklistEntries: [
          {
            address: "0xbadbadbadbadbadbadbadbadbadbadbadbadbad0",
            name: "Phishing Scammer",
            category: "Scam",
            addedAt: Date.now(),
          },
        ],
      };

      const result = evaluateBatchPreflight(batch, ctx);
      const threatCheck = result.checks.find((c) => c.id === "threat_guard");
      expect(threatCheck?.status).toBe("fail");
      expect(result.allChecksPassed).toBe(false);
    });
  });

  describe("evaluateBatchPaymentQuery", () => {
    it("evaluates natural language batch query with contacts", () => {
      const res = evaluateBatchPaymentQuery(
        "batch send 50 USDG to Alice and 150 USDG to Bob",
        { contacts: CONTACTS }
      );
      expect(res).not.toBeNull();
      expect(res?.handled).toBe(true);
      expect(res?.intent.type).toBe("batch_payment");
      expect(res?.intent.itemCount).toBe(2);
      expect(res?.intent.totalAmounts["USDG"]).toBe(200);
      expect(res?.summary).toContain("Pre-Flight Batch Payment Proposal");
      expect(res?.details.length).toBeGreaterThan(3);
    });

    it("evaluates scheduled multi-pay query", () => {
      const res = evaluateBatchPaymentQuery(
        "schedule batch payment: 100 USDG to Alice and 200 USDG to Bob tomorrow",
        { contacts: CONTACTS }
      );
      expect(res).not.toBeNull();
      expect(res?.intent.isScheduled).toBe(true);
      expect(res?.intent.scheduledDelay).toBe("Tomorrow at 09:00 UTC");
      expect(res?.summary).toContain("[Scheduled: Tomorrow at 09:00 UTC]");
    });

    it("returns null for non-batch general prompts", () => {
      const res1 = evaluateBatchPaymentQuery("what is my spending limit?", { contacts: CONTACTS });
      expect(res1).toBeNull();

      const res2 = evaluateBatchPaymentQuery("send 10 USDG to Alice", { contacts: CONTACTS });
      expect(res2).toBeNull();
    });
  });
});
