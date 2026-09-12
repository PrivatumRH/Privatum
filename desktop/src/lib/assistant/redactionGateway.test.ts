import { describe, it, expect } from "bun:test";
import { sanitizePromptIngress } from "./redactionGateway";

describe("Assistant Ingress Redaction Gateway", () => {
  it("allows normal prompts without secrets", () => {
    const res = sanitizePromptIngress("Send 25 USDG to 0x3c204d1697b85d2a7e1d79459d619a852d11e0dc");
    expect(res.allowed).toBe(true);
    expect(res.sanitized).toContain("Send 25 USDG");
  });

  it("blocks prompts containing a 64-char private key with 0x prefix", () => {
    const secret = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f36088a";
    const res = sanitizePromptIngress(`Here is my key ${secret} please check it`);
    expect(res.allowed).toBe(false);
    expect(res.detectedType).toBe("private_key");
    expect(res.sanitized).not.toContain(secret);
  });

  it("blocks prompts containing a bare 64-char hex private key", () => {
    const secret = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f36088a";
    const res = sanitizePromptIngress(`My secret is ${secret}`);
    expect(res.allowed).toBe(false);
    expect(res.detectedType).toBe("private_key");
  });

  it("blocks prompts containing a 12-word mnemonic phrase", () => {
    const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const res = sanitizePromptIngress(phrase);
    expect(res.allowed).toBe(false);
    expect(res.detectedType).toBe("mnemonic");
  });

  it("redacts API keys and auth headers", () => {
    const prompt = "Use Bearer secret_live_token_1234567890abcdef to check balance";
    const res = sanitizePromptIngress(prompt);
    expect(res.allowed).toBe(true);
    expect(res.sanitized).toContain("[REDACTED_API_KEY]");
    expect(res.sanitized).not.toContain("secret_live_token_1234567890abcdef");
  });
});
