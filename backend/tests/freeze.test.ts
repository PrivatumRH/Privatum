import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";
import { generateShardKey } from "../src/crypto";
import { base32Decode, generateTotpCode } from "../src/totp";
import { MAX_FAILED_ATTEMPTS } from "../src/freeze";

describe("Panic Freeze API", () => {
  const walletAccount = generateShardKey();
  const shardA = generateShardKey();
  const shardC = generateShardKey();

  let apiKey = "";
  let totpSecret = "";

  const code = () => generateTotpCode(base32Decode(totpSecret));

  it("registers a wallet and enrols an authenticator", async () => {
    const reg = await request(app).post("/v1/wallets").send({
      address: walletAccount.address,
      shardAAddress: shardA.address,
      shardCAddress: shardC.address,
    });
    expect(reg.status).toBe(201);
    apiKey = reg.body.apiKey;

    const setup = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/totp/setup`)
      .set("Authorization", `Bearer ${apiKey}`);
    expect(setup.status).toBe(200);
    totpSecret = setup.body.secret;

    const confirm = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/totp/confirm`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ code: code() });
    expect(confirm.status).toBe(200);
    expect(confirm.body.enabled).toBe(true);
  });

  it("reports an unfrozen wallet before anything is frozen", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAccount.address}/freeze`);
    expect(res.status).toBe(200);
    expect(res.body.frozen).toBe(false);
  });

  it("co-signs normally while the wallet is unfrozen", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/cosign`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ userOpHash: `0x${"ab".repeat(32)}` });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("freezes with only a 6-digit code and no session", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/freeze`)
      .send({ code: code(), hours: 24 });

    expect(res.status).toBe(200);
    expect(res.body.frozen).toBe(true);
    expect(typeof res.body.frozenUntil).toBe("string");
  });

  it("refuses to co-sign for a frozen wallet even with a valid session", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/cosign`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ userOpHash: `0x${"cd".repeat(32)}` });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe("WALLET_FROZEN");
    expect(res.body.signatureB).toBeUndefined();
  });

  it("rejects an unfreeze that carries the wrong code", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/unfreeze`)
      .send({ code: "000000" });

    expect(res.status).toBe(401);
    const state = await request(app).get(`/v1/wallets/${walletAccount.address}/freeze`);
    expect(state.body.frozen).toBe(true);
  });

  it("unfreezes with the authenticator and resumes co-signing", async () => {
    const res = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/unfreeze`)
      .send({ code: code() });
    expect(res.status).toBe(200);
    expect(res.body.frozen).toBe(false);

    const cosign = await request(app)
      .post(`/v1/wallets/${walletAccount.address}/cosign`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ userOpHash: `0x${"ef".repeat(32)}` });
    expect(cosign.status).toBe(200);
    expect(cosign.body.status).toBe("APPROVED");
  });

  it("records the freeze and unfreeze in the owner's audit trail", async () => {
    const res = await request(app)
      .get(`/v1/wallets/${walletAccount.address}/freeze/events`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    const actions = res.body.events.map((e: { action: string }) => e.action);
    expect(actions).toContain("freeze");
    expect(actions).toContain("unfreeze");
  });

  it("hides the audit trail from callers without a session", async () => {
    const res = await request(app).get(`/v1/wallets/${walletAccount.address}/freeze/events`);
    expect(res.status).toBe(401);
  });
});

describe("Panic Freeze abuse resistance", () => {
  const victim = generateShardKey();
  const shardA = generateShardKey();
  const shardC = generateShardKey();

  it("locks out an address after repeated wrong codes", async () => {
    await request(app).post("/v1/wallets").send({
      address: victim.address,
      shardAAddress: shardA.address,
      shardCAddress: shardC.address,
    });

    let lastStatus = 0;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS + 1; i++) {
      const res = await request(app)
        .post(`/v1/wallets/${victim.address}/freeze`)
        .send({ code: "123456", hours: 1 });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);

    const state = await request(app).get(`/v1/wallets/${victim.address}/freeze`);
    expect(state.body.frozen).toBe(false);
  });

  it("answers identically for an unknown wallet and a wrong code", async () => {
    const stranger = generateShardKey();
    const res = await request(app)
      .post(`/v1/wallets/${stranger.address}/freeze`)
      .send({ code: "123456", hours: 1 });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("VERIFICATION_FAILED");
  });

  it("refuses a freeze from a wallet with no authenticator enrolled", async () => {
    const bare = generateShardKey();
    const a = generateShardKey();
    const c = generateShardKey();
    await request(app).post("/v1/wallets").send({
      address: bare.address,
      shardAAddress: a.address,
      shardCAddress: c.address,
    });

    const res = await request(app)
      .post(`/v1/wallets/${bare.address}/freeze`)
      .send({ code: "123456", hours: 1 });
    expect(res.status).toBe(401);
  });
});
