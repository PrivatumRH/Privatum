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

describe("RemoteCosigner", () => {
  const dummyCosignerAddress = "0x2222222222222222222222222222222222222222";
  const dummyWalletAddress = "0x3333333333333333333333333333333333333333";

  it("defaults to official PRIVATUM co-signer API URL", () => {
    const cosigner = new (require("../src/shard.js").RemoteCosigner)(
      dummyCosignerAddress,
      dummyWalletAddress
    );
    expect(cosigner.apiUrl).toBe("https://api.privatumrh.com");
  });

  it("supports custom API URL and custom headers", () => {
    const cosigner = new (require("../src/shard.js").RemoteCosigner)({
      address: dummyCosignerAddress,
      walletAddress: dummyWalletAddress,
      apiUrl: "https://my-cosigner.enterprise.com",
      headers: { "X-Enterprise-Tenant": "tenant_123" },
    });
    expect(cosigner.apiUrl).toBe("https://my-cosigner.enterprise.com");
    expect(cosigner.headers["X-Enterprise-Tenant"]).toBe("tenant_123");
  });

  it("supports pluggable customSigner callback", async () => {
    const mockSignature = `0x${"ff".repeat(65)}` as const;
    const cosigner = new (require("../src/shard.js").RemoteCosigner)({
      address: dummyCosignerAddress,
      walletAddress: dummyWalletAddress,
      customSigner: async (hash: string, apiKey: string) => {
        expect(apiKey).toBe("test_api_key");
        return mockSignature;
      },
    });

    const sig = await cosigner.signHash("0x1111", "test_api_key");
    expect(sig).toBe(mockSignature);
  });
});
