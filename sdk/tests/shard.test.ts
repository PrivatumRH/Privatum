import { describe, expect, it } from "bun:test";
import { isAddress, isHex, recoverMessageAddress } from "viem";
import { LocalShard } from "../src/shard.js";

describe("LocalShard", () => {
  it("generates a valid secp256k1 keypair", () => {
    const shard = LocalShard.create("device");
    expect(shard.role).toBe("device");
    expect(isHex(shard.privateKey)).toBe(true);
    expect(shard.privateKey.length).toBe(66);
    expect(isAddress(shard.address)).toBe(true);
  });

  it("can be recreated from existing private key", () => {
    const original = LocalShard.create("recovery");
    const restored = LocalShard.fromPrivateKey(original.privateKey, "recovery");
    expect(restored.address).toBe(original.address);
    expect(restored.role).toBe("recovery");
  });

  it("signs a 32-byte hash and yields a recoverable signature", async () => {
    const shard = LocalShard.create("device");
    const testHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const sig = await shard.signHash(testHash);

    expect(isHex(sig)).toBe(true);
    expect(sig.length).toBe(132); // 0x + 65 bytes (130 hex chars)

    const recovered = await recoverMessageAddress({
      message: { raw: new Uint8Array(32).fill(0xaa) },
      signature: sig,
    });
    expect(recovered.toLowerCase()).toBe(shard.address.toLowerCase());
  });

  it("rejects invalid hash length", async () => {
    const shard = LocalShard.create("device");
    expect(shard.signHash("0x1234" as any)).rejects.toThrow("Invalid hash");
  });
});
