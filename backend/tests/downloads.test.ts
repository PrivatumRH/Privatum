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

  it("handles platform download redirect for windows", async () => {
    const res = await request(app).get("/v1/downloads/windows");
    expect([200, 302]).toContain(res.status);
  });

  it("handles platform download redirect for macos", async () => {
    const res = await request(app).get("/v1/downloads/macos");
    expect([200, 302]).toContain(res.status);
  });

  it("handles platform download redirect for linux", async () => {
    const res = await request(app).get("/v1/downloads/linux");
    expect([200, 302]).toContain(res.status);
  });
});
