import { describe, it, expect } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Downloads API Endpoints", () => {
  it("returns latest download metadata with platform entries including android", async () => {
    const res = await request(app).get("/v1/downloads/latest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("downloads");
    expect(res.body.downloads).toHaveProperty("windows");
    expect(res.body.downloads).toHaveProperty("macos");
    expect(res.body.downloads).toHaveProperty("linux");
    expect(res.body.downloads).toHaveProperty("android");
    expect(res.body.downloads.android.platform).toBe("android");
  });

  it("returns latest mobile release metadata and android download info", async () => {
    const res = await request(app).get("/v1/downloads/mobile/latest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("android");
    expect(res.body.android).toHaveProperty("filename");
    expect(res.body.android).toHaveProperty("url");
    expect(res.body.android.url).toBe("/v1/downloads/android");
    expect(res.body).toHaveProperty("ios");
    expect(res.body.ios.status).toBe("coming_soon");
  });

  it("handles mobile metadata redirect alias /v1/downloads/mobile", async () => {
    const res = await request(app).get("/v1/downloads/mobile");
    expect([200, 307]).toContain(res.status);
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

  it("handles android platform download redirect for /v1/downloads/android", async () => {
    const res = await request(app).get("/v1/downloads/android");
    expect([200, 302]).toContain(res.status);
  });

  it("handles mobile android download redirect alias /v1/downloads/mobile/android", async () => {
    const res = await request(app).get("/v1/downloads/mobile/android");
    expect([200, 302, 307]).toContain(res.status);
  });
});
