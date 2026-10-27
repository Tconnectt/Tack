import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema.ts";
import type { GoogleVerifier } from "../src/services/google.ts";
import { startTestApp } from "./helpers.ts";

// A fake Google: "good|sub|email|name" is accepted, "unverified|..." has an unverified email, anything else is rejected.
const verifier: GoogleVerifier = async (credential) => {
  const [kind, sub, email, name] = credential.split("|");
  if (kind !== "good" && kind !== "unverified") throw new Error("bad token");
  return { sub, email, emailVerified: kind === "good", name };
};
const token = (kind: string, sub: string, email: string, name: string) => `${kind}|${sub}|${email}|${name}|padding-to-pass-length-check`;

describe("google sign-in", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const google = (credential: string) => app.call("POST", "/api/auth/google", { body: { credential } });

  before(async () => {
    app = await startTestApp({ googleVerifier: verifier });
  });
  after(() => app.close());

  it("creates an account, and the first account on the system becomes the manager", async () => {
    const r = await google(token("good", "g-1", "first@example.com", "First Person"));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.user.email, "first@example.com");
    assert.equal(r.body.data.user.role, "manager");
    const me = await app.call("GET", "/api/auth/me", { token: r.body.data.token });
    assert.equal(me.status, 200);
  });

  it("signs the same person in again without making a duplicate, and later accounts are technicians", async () => {
    const again = await google(token("good", "g-1", "first@example.com", "First Person"));
    assert.equal(again.status, 200);
    const second = await google(token("good", "g-2", "second@example.com", "Second Person"));
    assert.equal(second.body.data.user.role, "technician");
    const rows = await app.db.select().from(users);
    assert.equal(rows.length, 2);
  });

  it("links to an existing password account with the same verified email", async () => {
    const reg = await app.signUp("Pat Password", "pat@example.com");
    const r = await google(token("good", "g-3", "pat@example.com", "Pat G"));
    assert.equal(r.body.data.user.id, reg.user.id);
    const [row] = await app.db.select().from(users).where(eq(users.email, "pat@example.com"));
    assert.equal(row.googleSub, "g-3");
    const pw = await app.call("POST", "/api/auth/login", { body: { email: "pat@example.com", password: "password123" } });
    assert.equal(pw.status, 200, "the password still works after linking");
  });

  it("refuses an invalid token and an unverified Google email", async () => {
    const bad = await google("not-a-real-google-token-at-all");
    assert.equal(bad.status, 401);
    assert.equal(bad.body.code, "GOOGLE_INVALID");
    const unverified = await google(token("unverified", "g-4", "x@example.com", "X"));
    assert.equal(unverified.status, 401);
    assert.equal((await app.db.select().from(users).where(eq(users.email, "x@example.com"))).length, 0);
  });

  it("does not let a Google-only account sign in with a password", async () => {
    const r = await app.call("POST", "/api/auth/login", { body: { email: "second@example.com", password: "password123" } });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "INVALID_CREDENTIALS");
  });
});

describe("google sign-in when not configured", () => {
  it("answers 501 with a clear message", async () => {
    const app = await startTestApp();
    try {
      const r = await app.call("POST", "/api/auth/google", { body: { credential: "x".repeat(30) } });
      assert.equal(r.status, 501);
      assert.equal(r.body.code, "GOOGLE_NOT_CONFIGURED");
    } finally {
      await app.close();
    }
  });
});
