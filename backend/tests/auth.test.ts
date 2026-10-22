import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp } from "./helpers.ts";

describe("auth", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  before(async () => {
    app = await startTestApp();
  });
  after(() => app.close());

  it("makes the first account a manager and later accounts technicians", async () => {
    const first = await app.signUp("Ada Manager", "ada@example.com");
    const second = await app.signUp("Tunde Tech", "tunde@example.com");
    assert.equal(first.user.role, "manager");
    assert.equal(second.user.role, "technician");
  });

  it("never returns the password hash", async () => {
    const r = await app.call("POST", "/api/auth/register", {
      body: { name: "Sade", email: "sade@example.com", password: "password123" },
    });
    assert.equal(r.status, 201);
    assert.equal(JSON.stringify(r.body).includes("password"), false);
  });

  it("rejects a duplicate email regardless of case", async () => {
    const r = await app.call("POST", "/api/auth/register", {
      body: { name: "Ada Again", email: "ADA@example.com", password: "password123" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "EMAIL_EXISTS");
  });

  it("validates registration input", async () => {
    const r = await app.call("POST", "/api/auth/register", {
      body: { name: "X", email: "not-an-email", password: "short" },
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "VALIDATION_ERROR");
    assert.ok(r.body.issues.length >= 3);
  });

  it("logs in with correct credentials", async () => {
    const r = await app.call("POST", "/api/auth/login", {
      body: { email: "Ada@Example.com", password: "password123" },
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.token);
  });

  it("rejects a wrong password and an unknown email the same way", async () => {
    const bad = await app.call("POST", "/api/auth/login", {
      body: { email: "ada@example.com", password: "wrong-password" },
    });
    const unknown = await app.call("POST", "/api/auth/login", {
      body: { email: "nobody@example.com", password: "password123" },
    });
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(bad.body.message, unknown.body.message);
  });

  it("returns the current user for a valid token and 401 without one", async () => {
    const { token } = await app.signUp("Me Person", "me@example.com");
    const ok = await app.call("GET", "/api/auth/me", { token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.email, "me@example.com");
    assert.equal((await app.call("GET", "/api/auth/me")).status, 401);
    assert.equal((await app.call("GET", "/api/auth/me", { token: "garbage" })).status, 401);
  });
});
