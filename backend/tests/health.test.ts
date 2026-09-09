import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Health Check Endpoint", () => {
  it("returns 200 with status ok and a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
    expect(isNaN(Date.parse(res.body.timestamp))).toBe(false);
    expect(res.body.chainId).toBe(4663);
  });
});
