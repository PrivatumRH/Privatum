import { describe, it, expect } from "bun:test";
import { processAssistantQuery } from "./assistantEngine";

describe("Assistant Engine Pipeline", () => {
  it("rejects prompt with private key via redaction gateway", async () => {
    const raw = "Here is 0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f36088a please send it";
    const res = await processAssistantQuery({ input: raw });
    expect(res.content).toContain("Security Alert");
    expect(res.safetyEvidence?.poisonVerdict).toBe("danger");
  });

  it("processes send transfer command with address", async () => {
    const raw = "Send 100 USDG to 0x3c204d1697b85d2a7e1d79459d619a852d11e0dc";
    const res = await processAssistantQuery({
      input: raw,
      contacts: [],
    });
    expect(res.intent?.type).toBe("send_transfer");
    if (res.intent?.type === "send_transfer") {
      expect(res.intent.amount).toBe("100");
      expect(res.intent.asset).toBe("USDG");
    }
    expect(res.inferenceReceipt).toBeDefined();
    expect(res.inferenceReceipt?.codeHash).toHaveLength(64);
    expect(res.inferenceReceipt?.engine).toBe("client-cpu-deterministic");
    expect(res.inferenceReceipt?.shortRef).toHaveLength(8);
  });

  it("processes freeze command", async () => {
    const raw = "Freeze wallet for 72 hours";
    const res = await processAssistantQuery({ input: raw });
    expect(res.intent?.type).toBe("panic_freeze");
    if (res.intent?.type === "panic_freeze") {
      expect(res.intent.hours).toBe(72);
    }
  });

  it("processes pay link command", async () => {
    const raw = "Generate paylink for 25 USDG memo team lunch";
    const res = await processAssistantQuery({ input: raw });
    expect(res.intent?.type).toBe("create_paylink");
    if (res.intent?.type === "create_paylink") {
      expect(res.intent.amount).toBe("25");
      expect(res.intent.memo).toContain("team lunch");
    }
  });

  it("answers greetings naturally in conversational fast parser", async () => {
    const res = await processAssistantQuery({ input: "hi" });
    expect(res.content).toContain("Hello! I am your Privatum Assistant");
  });

  it("answers identity question who are you", async () => {
    const res = await processAssistantQuery({ input: "who are you?" });
    expect(res.content).toContain("Privatum Assistant");
    expect(res.content).toContain("Robinhood Chain");
  });

  it("answers time inquiries accurately", async () => {
    const res = await processAssistantQuery({ input: "whats the time" });
    expect(res.content).toContain("The current local time is");
  });

  it("processes multi-intent compound commands", async () => {
    const raw = "Send 10 USDG to 0x3c204d1697b85d2a7e1d79459d619a852d11e0dc and create a 25 USDG pay link";
    const res = await processAssistantQuery({ input: raw });
    expect(res.intent?.type).toBe("multi_intent_plan");
    if (res.intent?.type === "multi_intent_plan") {
      expect(res.intent.steps.length).toBe(2);
      expect(res.intent.steps[0].intent.type).toBe("send_transfer");
      expect(res.intent.steps[1].intent.type).toBe("create_paylink");
    }
  });

  it("processes natural language spending headroom queries", async () => {
    const res = await processAssistantQuery({
      input: "How much headroom do I have left?",
      guardrailConfig: {
        enabled: true,
        singleTxLimitUsd: 500,
        dailyLimitUsd: 1000,
        strictMode: true,
      },
      spendingHistory: [],
    });
    expect(res.intent?.type).toBe("ledger_query");
    expect(res.content).toContain("1000.00 USD remaining");
  });

  it("answers conceptual privacy queries via domain knowledge base", async () => {
    const res = await processAssistantQuery({
      input: "Explain how stealth addresses protect recipient privacy",
      preferredEngine: "deterministic",
    });
    expect(res.content).toContain("Stealth addresses protect recipient privacy");
    expect(res.content).toContain("On-Chain Unlinkability");
    expect(res.content).toContain("ERC-5564");
    expect(res.inferenceReceipt?.engine).toBe("client-cpu-deterministic");
  });

  it("answers conceptual privacy queries under smollm2_wasm mode gracefully", async () => {
    const res = await processAssistantQuery({
      input: "Explain how stealth addresses protect recipient privacy",
      preferredEngine: "smollm2_wasm",
    });
    expect(res.content).toContain("Stealth addresses protect recipient privacy");
    expect(res.content).toContain("ERC-5564");
    expect(res.inferenceReceipt?.engine).toBe("client-cpu-wasm");
  });

  it("does not tell user to toggle Enable AI if already in smollm2_wasm mode on unparsed query", async () => {
    const res = await processAssistantQuery({
      input: "xyz123randomnonexistentcommand",
      preferredEngine: "smollm2_wasm",
    });
    expect(res.content).not.toContain("Or toggle **Enable AI**");
    expect(res.content).toContain("Explain how stealth addresses protect recipient privacy");
  });

  it("processes outbox queries and yields broadcast intent through pipeline", async () => {
    const res = await processAssistantQuery({
      input: "broadcast my queued transfers",
      offlineOutbox: [
        {
          id: "tx-queued-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          nonce: 3,
          recipient: "0x2222222222222222222222222222222222222222",
          amount: "0.5",
          asset: "ETH",
          rawSignedTx: "0x02f8",
          txHash: "0x3333",
          gasLimit: "21000",
          chainId: 11155111,
          createdAt: Date.now(),
          status: "queued",
        },
      ],
      isOnline: true,
      forceAirGap: false,
    });
    expect(res.intent?.type).toBe("broadcast_outbox");
    expect(res.content).toContain("Found 1 queued transfer");
    expect(res.safetyEvidence?.intentSummary).toContain("Outbox Intelligence");
  });

  it("answers conceptual offline outbox queries via domain knowledge base", async () => {
    const res = await processAssistantQuery({
      input: "How does the offline outbox work?",
      preferredEngine: "deterministic",
    });
    expect(res.content).toContain("Offline Outbox allows you to sign transfers securely");
    expect(res.content).toContain("Local Shard A Signing");
    expect(res.content).toContain("Strict Sequential Nonces");
  });

  it("processes security policy queries and yields add_whitelist intent through pipeline", async () => {
    const res = await processAssistantQuery({
      input: "whitelist 0x3f8a0000000000000000000000000000000091b2",
      whitelistEntries: [],
      whitelistConfig: { strictMode: true },
    });
    expect(res.intent?.type).toBe("add_whitelist");
    expect(res.content).toContain("Ready to approve");
    expect(res.safetyEvidence?.intentSummary).toContain("Security Policy");
  });

  it("answers conceptual security queries via domain knowledge base", async () => {
    const res = await processAssistantQuery({
      input: "How does the transfer blacklist work?",
      preferredEngine: "deterministic",
    });
    expect(res.content).toContain("Transfer Blacklist provides deterministic blocking");
    expect(res.content).toContain("Curated Threat Feed");
    expect(res.content).toContain("Pre-Flight Enforcement");
  });

  it("processes spending analytics queries through pipeline", async () => {
    const res = await processAssistantQuery({
      input: "What is my spending breakdown by tag?",
      transactionHistory: [
        {
          type: "send",
          counterparty: "0x1111111111111111111111111111111111111111",
          amount: "100",
          asset: "USDG",
          tag: "Payroll",
        },
      ],
    });
    expect(res.intent?.type).toBe("spending_analytics");
    expect(res.content).toContain("Payroll");
    expect(res.safetyEvidence?.intentSummary).toContain("Spending Analytics");
  });

  it("processes wallet health report query through pipeline", async () => {
    const res = await processAssistantQuery({
      input: "Give me a full wallet health report",
      guardrailConfig: {
        enabled: true,
        dailyLimitUsd: 1000,
        singleTxLimitUsd: 500,
        strictMode: true,
      },
    });
    expect(res.intent?.type).toBe("wallet_health_report");
    expect(res.content).toContain("Wallet Health Audit:");
    expect(res.safetyEvidence?.intentSummary).toContain("Wallet Health Audit");
  });

  it("processes ledger search queries through pipeline", async () => {
    const res = await processAssistantQuery({
      input: "Show me all Payroll transactions",
      transactionHistory: [
        {
          type: "send",
          counterparty: "0x1111111111111111111111111111111111111111",
          amount: "150",
          asset: "USDG",
          tag: "Payroll",
        },
      ],
    });
    expect(res.intent?.type).toBe("ledger_search");
    expect(res.content).toContain("Ledger Search: Found 1 transaction(s)");
    expect(res.safetyEvidence?.intentSummary).toContain("Ledger Search: 1 result(s) matched");
  });
});


