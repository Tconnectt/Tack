import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";
import { startTestApp } from "./helpers.ts";

describe("config", () => {
  it("rejects a missing, placeholder or short JWT secret", () => {
    assert.throws(() => loadConfig({}), /missing/);
    assert.throws(() => loadConfig({ JWT_SECRET: "replace-with-a-generated-random-secret" }), /missing/);
    assert.throws(() => loadConfig({ JWT_SECRET: "short" }), /too short/);
  });

  it("accepts a long secret", () => {
    const c = loadConfig({ JWT_SECRET: "a".repeat(32), FRONTEND_URL: "https://example.com" });
    assert.equal(c.frontendUrl, "https://example.com");
  });
});

describe("cors", () => {
  it("allows no browser origin when FRONTEND_URL is not set", async () => {
    const app = await startTestApp();
    try {
      const res = await fetch(`${app.base}/api/health`, { headers: { Origin: "https://evil.example" } });
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      await app.close();
    }
  });
});
