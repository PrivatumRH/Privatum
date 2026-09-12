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
});
