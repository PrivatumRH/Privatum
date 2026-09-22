import { beforeEach, describe, expect, it } from "bun:test";
import { loadPrivacyProfile, requiresStealthMetaAddress, savePrivacyProfile } from "./privacyProfiles";

describe("Privacy Posture Profiles", () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    (globalThis as any).localStorage = { getItem: (key: string) => store[key] || null, setItem: (key: string, value: string) => { store[key] = value; } };
  });
  it("defaults to standard and persists selected profiles", () => {
    expect(loadPrivacyProfile()).toBe("standard");
    savePrivacyProfile("maximum");
    expect(loadPrivacyProfile()).toBe("maximum");
  });
  it("requires a stealth meta-address for private and maximum profiles", () => {
    expect(requiresStealthMetaAddress("standard")).toBe(false);
    expect(requiresStealthMetaAddress("private")).toBe(true);
    expect(requiresStealthMetaAddress("maximum")).toBe(true);
  });
});
