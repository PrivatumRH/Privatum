import { describe, it, expect } from "bun:test";
import { splitCompoundPrompt, parseMultiIntent } from "./multiIntent";
import type { Contact } from "../contacts";

describe("Multi-Intent Command Chaining", () => {
  const mockContacts: Contact[] = [
    {
      id: "contact-1",
      name: "Alice",
      address: "0x3f8a0000000000000000000000000000000091b2",
      createdAt: Date.now(),
    },
    {
      id: "contact-2",
      name: "Bob",
      address: "0x7b2200000000000000000000000000000000c418",
      createdAt: Date.now(),
    },
  ];

  it("splits compound prompts across 'and then', 'then', ';', and 'and <verb>'", () => {
    const parts1 = splitCompoundPrompt("send 10 USDG to Alice and create a 25 USDG pay link");
    expect(parts1).toEqual(["send 10 USDG to Alice", "create a 25 USDG pay link"]);

    const parts2 = splitCompoundPrompt("send 5 ETH to Bob then freeze wallet");
    expect(parts2).toEqual(["send 5 ETH to Bob", "freeze wallet"]);

    const parts3 = splitCompoundPrompt("paylink 50 USDG; freeze wallet for 4 hours");
    expect(parts3).toEqual(["paylink 50 USDG", "freeze wallet for 4 hours"]);
  });

  it("parses compound transfer and paylink intents", () => {
    const plan = parseMultiIntent(
      "Send 10 USDG to Alice and create a 25 USDG pay link",
      mockContacts
    );

    expect(plan).not.toBeNull();
    expect(plan?.steps.length).toBe(2);

    expect(plan?.steps[0].intent.type).toBe("send_transfer");
    expect(plan?.steps[0].summary).toContain("10 USDG to Alice");

    expect(plan?.steps[1].intent.type).toBe("create_paylink");
    expect(plan?.steps[1].summary).toContain("25 USDG payment link");
  });

  it("parses transfer followed by emergency panic freeze", () => {
    const plan = parseMultiIntent(
      "Send 5 ETH to Bob then panic freeze wallet for 2 hours",
      mockContacts
    );

    expect(plan).not.toBeNull();
    expect(plan?.steps.length).toBe(2);

    expect(plan?.steps[0].intent.type).toBe("send_transfer");
    expect(plan?.steps[1].intent.type).toBe("panic_freeze");
  });

  it("returns null for a single standalone intent", () => {
    const plan = parseMultiIntent("Send 10 USDG to Alice", mockContacts);
    expect(plan).toBeNull();
  });

  it("returns null when only one clause is an actionable intent", () => {
    const plan = parseMultiIntent("Hello there and send 10 USDG to Alice", mockContacts);
    expect(plan).toBeNull();
  });
});
