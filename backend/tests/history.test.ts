import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp } from "./helpers.ts";

describe("equipment history", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let manager: string;
  let technician: string;
  let id: string;

  const history = async () => (await app.call("GET", `/api/equipment/${id}/history`, { token: technician })).body.data as any[];

  before(async () => {
    app = await startTestApp({ now: () => new Date("2026-10-22T11:00:00Z") });
    manager = (await app.signUp("Ada Manager", "ada@example.com")).token;
    technician = (await app.signUp("Tunde Tech", "tunde@example.com")).token;
    const r = await app.call("POST", "/api/equipment", {
      token: manager,
      body: { name: "Monitor", model: "MX450", serialNumber: "H-1", department: "ICU", installedOn: "2026-01-01" },
    });
    id = r.body.data.id;
  });
  after(() => app.close());

  it("records who added the equipment", async () => {
    const h = await history();
    assert.equal(h.length, 1);
    assert.equal(h[0].kind, "created");
    assert.equal(h[0].actorName, "Ada Manager");
  });

  it("records each changed field with the old and new value", async () => {
    await app.call("PATCH", `/api/equipment/${id}`, {
      token: manager,
      body: { department: "Theatre 1", notes: "Moved", serviceIntervalDays: 90 },
    });
    const h = await history();
    assert.equal(h[0].kind, "updated");
    assert.deepEqual(
      h[0].changes.sort((a: any, b: any) => a.field.localeCompare(b.field)),
      [
        { field: "department", from: "ICU", to: "Theatre 1" },
        { field: "notes", from: null, to: "Moved" },
        { field: "serviceIntervalDays", from: null, to: 90 },
      ],
    );
  });

  it("does not record an update that changes nothing", async () => {
    const before = (await history()).length;
    await app.call("PATCH", `/api/equipment/${id}`, { token: manager, body: { department: "Theatre 1" } });
    assert.equal((await history()).length, before);
  });

  it("records a status change made through a service record, with the previous status", async () => {
    const r = await app.call("POST", `/api/equipment/${id}/maintenance`, {
      token: technician,
      body: { performedOn: "2026-10-20", type: "corrective", description: "Screen fault", setStatus: "out_of_service" },
    });
    assert.equal(r.status, 201);
    const h = await history();
    assert.equal(h[0].kind, "status_changed");
    assert.equal(h[0].actorName, "Tunde Tech");
    assert.deepEqual(h[0].changes, [{ field: "status", from: "in_service", to: "out_of_service" }]);
    assert.equal(h[0].logId, r.body.data.id);
  });

  it("skips the event when the service record leaves the status as it was", async () => {
    const before = (await history()).length;
    await app.call("POST", `/api/equipment/${id}/maintenance`, {
      token: technician,
      body: { performedOn: "2026-10-21", type: "inspection", description: "Still down", setStatus: "out_of_service" },
    });
    assert.equal((await history()).length, before);
  });

  it("returns 404 for unknown equipment and requires sign-in", async () => {
    const missing = await app.call("GET", "/api/equipment/00000000-0000-4000-8000-000000000000/history", { token: manager });
    assert.equal(missing.status, 404);
    assert.equal((await app.call("GET", `/api/equipment/${id}/history`)).status, 401);
  });
});
