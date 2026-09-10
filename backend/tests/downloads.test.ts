import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Downloads API Endpoints", () => {
  it("returns latest download metadata with platform entries", async () => {
    const res = await request(app).get("/v1/downloads/latest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("downloads");
    expect(res.body.downloads).toHaveProperty("windows");
    expect(res.body.downloads).toHaveProperty("macos");
    expect(res.body.downloads).toHaveProperty("linux");
  });

  it("handles platform download redirect or resolution for windows", async () => {
    const res = await request(app).get("/v1/downloads/windows");
    // Should either redirect (302) to CDN or return 200/404 based on token
    expect([200, 302, 404]).toContain(res.status);
  });
});
