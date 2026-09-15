import { beforeEach, describe, expect, it } from "bun:test";
import { addWhitelistEntry, importWhitelistJson, isWhitelisted, loadWhitelist, saveWhitelistConfig, loadWhitelistConfig } from "./transferWhitelist";

const address = "0x1111111111111111111111111111111111111111";

describe("Transfer Whitelist Engine (v0.1.34)", () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = { getItem: (key: string) => store[key] || null, setItem: (key: string, value: string) => { store[key] = value; } };
  });
  it("adds and matches approved counterparties case-insensitively", () => {
    addWhitelistEntry({ address, label: "Treasury" });
    expect(loadWhitelist()).toHaveLength(1);
    expect(isWhitelisted(address.toUpperCase())).toBe(true);
  });
  it("persists strict mode separately from entries", () => {
    saveWhitelistConfig({ strictMode: true });
    expect(loadWhitelistConfig().strictMode).toBe(true);
  });
  it("imports valid entries and skips malformed entries", () => {
    importWhitelistJson(JSON.stringify([{ address, label: "Vendor" }, { address: "bad", label: "No" }]));
    expect(loadWhitelist()).toHaveLength(1);
  });
});
