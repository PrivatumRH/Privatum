import { describe, it, expect } from "bun:test";
import { queryKnowledgeBase } from "./knowledgeBase";

describe("Domain Knowledge Base", () => {
  it("answers stealth addresses and recipient privacy queries", () => {
    const res = queryKnowledgeBase("Explain how stealth addresses protect recipient privacy");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("stealth_addresses");
    expect(res?.summary).toContain("Stealth addresses protect recipient privacy");
    expect(res?.bulletPoints.length).toBeGreaterThan(2);
  });

  it("answers MPC and shard queries", () => {
    const res = queryKnowledgeBase("how does 2-of-2 MPC work with Shard A and Shard B?");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("mpc_shards");
    expect(res?.summary).toContain("2-of-2 Multi-Party Computation");
  });

  it("answers address poisoning queries", () => {
    const res = queryKnowledgeBase("what is address poisoning and how do you detect it?");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("address_poisoning");
    expect(res?.summary).toContain("Address poisoning is an attack");
  });

  it("answers spending guardrails queries", () => {
    const res = queryKnowledgeBase("how do spending guardrails and velocity limits work?");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("spending_guardrails");
  });

  it("answers disposable paylink queries", () => {
    const res = queryKnowledgeBase("what are disposable paylinks?");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("paylinks");
  });

  it("answers telemetry and privacy questions", () => {
    const res = queryKnowledgeBase("does Privatum track my transactions or send telemetry?");
    expect(res).not.toBeNull();
    expect(res?.topic).toBe("privacy_and_security");
  });

  it("returns null for unrelated transaction commands", () => {
    const res = queryKnowledgeBase("send 10 USDG to 0x1234567890123456789012345678901234567890");
    expect(res).toBeNull();
  });
});
