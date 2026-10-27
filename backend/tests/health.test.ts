import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp } from "./helpers.ts";

describe("health", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  before(async () => {
    app = await startTestApp();
  });
  after(() => app.close());

  it("reports the database as up", async () => {
    const res = await app.call("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.database, "up");
  });
});
