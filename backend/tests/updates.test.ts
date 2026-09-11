import { describe, expect, test } from "bun:test";
import request from "supertest";
import { app } from "../src/app";

describe("Desktop Updates API", () => {
  test("returns update manifest when older version requests check", async () => {
    const res = await request(app).get("/v1/updates/desktop/linux-x86_64/0.1.6");
    expect(res.status).toBe(200);
    expect(res.body.shouldUpdate).toBe(true);
    expect(res.body.latestVersion).toBe("0.1.7");
    expect(res.body.downloadUrl).toContain("AppImage");
  });

  test("returns shouldUpdate false when current version is latest", async () => {
    const res = await request(app).get("/v1/updates/desktop/linux-x86_64/0.1.7");
    expect(res.status).toBe(200);
    expect(res.body.shouldUpdate).toBe(false);
  });

  test("serves standard latest.json format", async () => {
    const res = await request(app).get("/v1/updates/desktop/latest.json");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("0.1.7");
    expect(res.body.platforms["linux-x86_64"]).toBeDefined();
  });
});
