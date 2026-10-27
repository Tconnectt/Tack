import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { users } from "../src/db/schema.ts";
import { startTestApp } from "./helpers.ts";

const equipment = { name: "Monitor", model: "MX450", serialNumber: "SEC-001", department: "ICU" };

describe("auth hardening", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  before(async () => {
    app = await startTestApp();
  });
  after(() => app.close());

  it("makes only one manager when sign-ups arrive at the same time", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => app.signUp(`User ${i}`, `user${i}@example.com`)),
    );
    const managers = results.filter((r) => r.user.role === "manager");
    assert.equal(managers.length, 1);
  });

  it("uses the role in the database, not the role in the token", async () => {
    const manager = await app.signUp("Boss", "boss@example.com");
    const tech = await app.signUp("Tech", "tech@example.com");
    // Make the first manager a technician in the database; their old token still says manager.
    const [boss] = await app.db.select().from(users).where(eq(users.email, "boss@example.com"));
    await app.db.update(users).set({ role: "technician" }).where(eq(users.id, boss.id));
    const denied = await app.call("POST", "/api/equipment", { token: manager.token, body: equipment });
    assert.equal(denied.status, 403);
    // And the reverse: promote the technician and the same token works.
    const [t] = await app.db.select().from(users).where(eq(users.email, "tech@example.com"));
    await app.db.update(users).set({ role: "manager" }).where(eq(users.id, t.id));
    const allowed = await app.call("POST", "/api/equipment", { token: tech.token, body: equipment });
    assert.equal(allowed.status, 201);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const u = await app.signUp("Gone", "gone@example.com");
    await app.db.delete(users).where(eq(users.email, "gone@example.com"));
    const r = await app.call("GET", "/api/auth/me", { token: u.token });
    assert.equal(r.status, 401);
  });
});
