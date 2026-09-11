import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Disposable Payment Links API", () => {
  const testRecipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  let createdSlug = "";

  it("POST /v1/paylinks/create - creates a new disposable payment link", async () => {
    const res = await request(app)
      .post("/v1/paylinks/create")
      .send({
        recipient_address: testRecipient,
        amount: "25.50",
        memo: "Test Design Work",
        token_symbol: "USDG",
        route_mode: "direct",
        expires_in_hours: 48,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.slug).toBeDefined();
    expect(res.body.slug.startsWith("pay_")).toBe(true);
    expect(res.body.deposit_address).toBeDefined();
    expect(res.body.deposit_address.startsWith("0x")).toBe(true);
    expect(res.body.expected_amount).toBe(25.5);
    expect(res.body.memo).toBe("Test Design Work");
    expect(res.body.token_symbol).toBe("USDG");
    expect(res.body.pay_url).toBeDefined();

    createdSlug = res.body.slug;
  });

  it("POST /v1/paylinks/create - rejects invalid recipient address", async () => {
    const res = await request(app)
      .post("/v1/paylinks/create")
      .send({
        recipient_address: "invalid-address",
        amount: "10",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("recipient_address");
  });

  it("GET /v1/paylinks/:slug - returns public metadata without leaking recipient", async () => {
    const res = await request(app).get(`/v1/paylinks/${createdSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const paylink = res.body.paylink;

    expect(paylink.slug).toBe(createdSlug);
    expect(paylink.deposit_address).toBeDefined();
    expect(paylink.expected_amount).toBe("25.500000000000000000");
    expect(paylink.memo).toBe("Test Design Work");
    expect(paylink.status).toBe("active");

    // CRITICAL PRIVACY CHECKS
    expect(paylink.recipient_address).toBeUndefined();
    expect(paylink.encrypted_burner_key).toBeUndefined();
    expect(paylink.key_iv).toBeUndefined();
    expect(paylink.key_tag).toBeUndefined();
  });

  it("GET /v1/paylinks/:slug - returns 404 for unknown slug", async () => {
    const res = await request(app).get("/v1/paylinks/pay_nonexistent999");
    expect(res.status).toBe(404);
  });

  it("GET /v1/paylinks/user/:address - lists links for the recipient", async () => {
    const res = await request(app).get(`/v1/paylinks/user/${testRecipient}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.paylinks)).toBe(true);
    expect(res.body.paylinks.length).toBeGreaterThan(0);
    expect(res.body.paylinks[0].slug).toBe(createdSlug);
  });

  it("POST /v1/paylinks/check/:slug - reports active/unfunded status before deposit", async () => {
    const res = await request(app).post(`/v1/paylinks/check/${createdSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.swept).toBe(false);
  }, 15000);

  it("POST /v1/paylinks/cancel/:slug - cancels an active paylink", async () => {
    const res = await request(app).post(`/v1/paylinks/cancel/${createdSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Paylink cancelled");

    // Fetch and check status is now cancelled
    const checkRes = await request(app).get(`/v1/paylinks/${createdSlug}`);
    expect(checkRes.body.paylink.status).toBe("cancelled");
  });
});
