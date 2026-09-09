import { describe, it, expect } from "bun:test";
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  generateTotpSecret,
  verifyTotp,
} from "../src/totp";

describe("TOTP Module", () => {
  it("encodes and decodes buffers in Base32 (RFC 4648)", () => {
    const secret = generateTotpSecret();
    const encoded = base32Encode(secret);

    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = base32Decode(encoded);
    expect(decoded).toEqual(secret);
  });

  it("builds valid otpauth URI for authenticator QR codes", () => {
    const address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const secret = base32Encode(generateTotpSecret());
    const uri = buildOtpAuthUri(secret, address);

    expect(uri.startsWith("otpauth://totp/Privatum:")).toBe(true);
    expect(uri.includes(`secret=${secret}`)).toBe(true);
    expect(uri.includes("issuer=Privatum")).toBe(true);
    expect(uri.includes("digits=6")).toBe(true);
  });

  it("rejects invalid or malformed TOTP codes", () => {
    const secret = generateTotpSecret();

    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });
});
