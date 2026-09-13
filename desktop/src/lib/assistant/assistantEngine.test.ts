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
});
