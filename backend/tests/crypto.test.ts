import { describe, it, expect } from "bun:test";
import {
  encryptSecret,
  decryptSecret,
  generateShardKey,
  generateApiKey,
  hashApiKey,
  signUserOpHash,
} from "../src/crypto";

describe("Crypto & Vault Module", () => {
  it("encrypts and decrypts secrets accurately using AES-256-GCM", () => {
    const original = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
    const encrypted = encryptSecret(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":").length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it("fails to decrypt if payload has been tampered with", () => {
    const original = "secret-message";
    const encrypted = encryptSecret(original);
    const parts = encrypted.split(":");
    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("generates valid secp256k1 shard keypair", () => {
    const { privateKey, address } = generateShardKey();

    expect(privateKey.startsWith("0x")).toBe(true);
    expect(privateKey.length).toBe(66);
    expect(address.startsWith("0x")).toBe(true);
    expect(address.length).toBe(42);
  });

  it("hashes and generates API keys", () => {
    const key = generateApiKey();
    expect(key.startsWith("pvt_")).toBe(true);

    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("produces deterministic 65-byte ECDSA signatures for userOpHash", async () => {
    const { privateKey, address } = generateShardKey();
    const mockUserOpHash = "0x" + "a".repeat(64);

    const { signature, signer } = await signUserOpHash(privateKey, mockUserOpHash);

    expect(signer.toLowerCase()).toBe(address.toLowerCase());
    expect(signature.startsWith("0x")).toBe(true);
    expect(signature.length).toBe(132); // 0x + 65 bytes = 132 hex chars
  });
});
