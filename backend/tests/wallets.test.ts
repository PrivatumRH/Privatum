import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";

describe("Wallets and Co-Signing API Flow", () => {
  const walletAccount = generateShardKey();
  const shardA = generateShardKey();
  const shardC = generateShardKey();

  let apiKey = "";

  it("registers a new 2-of-3 threshold wallet", async () => {
    const res = await request(app)
      .post("/v1/wallets")
      .send({
        address: walletAccount.address,
        shardAAddress: shardA.address,
        shardCAddress: shardC.address,
      });

    expect(res.status).toBe(201);
    expect(res.body.address.toLowerCase()).toBe(walletAccount.address.toLowerCase());
    expect(res.body.shardAAddress.toLowerCase()).toBe(shardA.address.toLowerCase());
    expect(res.body.shardBAddress.startsWith("0x")).toBe(true);
    expect(res.body.shardCAddress.toLowerCase()).toBe(shardC.address.toLowerCase());
    expect(res.body.threshold).toBe(2);
    expect(res.body.chainId).toBe(4663);
    expect(res.body.apiKey.startsWith("pvt_")).toBe(true);

    apiKey = res.body.apiKey;
  });

  it("prevents duplicate registration of the same wallet address", async () => {
    const res = await request(app)
      .post("/v1/wallets")
      .send({
        address: walletAccount.address,
        shardAAddress: shardA.address,
        shardCAddress: shardC.address,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_REGISTERED");
  });

  it("retrieves public metadata for a registered wallet", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAccount.address}`);

    expect(res.status).toBe(200);
    expect(res.body.address.toLowerCase()).toBe(walletAccount.address.toLowerCase());
    expect(res.body.chainId).toBe(4663);
    expect(res.body.threshold).toBe(2);
    // Never leaks Shard B private key
    expect(res.body.shardBPrivateKey).toBeUndefined();
  });

  it("rejects unauthorized co-signing requests without valid API key", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/cosign`)
      .send({
        userOpHash: "0x" + "1".repeat(64),
      });

    expect(res.status).toBe(401);
  });

  it("co-signs a valid userOpHash for an authenticated session", async () => {
    const mockHash = "0x" + "b".repeat(64);

    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/cosign`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        userOpHash: mockHash,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.userOpHash).toBe(mockHash);
    expect(res.body.signatureB.startsWith("0x")).toBe(true);
    expect(res.body.signatureB.length).toBe(132); // 65-byte ECDSA signature
  });

  it("initiates TOTP recovery setup for authenticated user", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/totp/setup`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.secret).toBe("string");
    expect(res.body.uri.startsWith("otpauth://totp/Privatum:")).toBe(true);
  });
});
