import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp } from "./helpers.ts";

const ecg = { name: "ECG Machine", model: "CardioPro 12", serialNumber: "ECG-001", department: "Cardiology" };
const pump = { name: "Infusion Pump", model: "InfuSafe 3", serialNumber: "INF-100", department: "Ward A" };

describe("equipment", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let manager: string;
  let technician: string;

  before(async () => {
    app = await startTestApp();
    manager = (await app.signUp("Ada Manager", "ada@example.com")).token;
    technician = (await app.signUp("Tunde Tech", "tunde@example.com")).token;
  });
  after(() => app.close());

  it("requires sign-in", async () => {
    assert.equal((await app.call("GET", "/api/equipment")).status, 401);
  });

  it("lets a manager add equipment, defaulting to in service", async () => {
    const r = await app.call("POST", "/api/equipment", { token: manager, body: ecg });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, "in_service");
    assert.equal(r.body.data.serialNumber, "ECG-001");
  });

  it("stops a technician from adding or editing equipment", async () => {
    const add = await app.call("POST", "/api/equipment", { token: technician, body: pump });
    assert.equal(add.status, 403);
    const list = await app.call("GET", "/api/equipment", { token: technician });
    const id = list.body.data[0].id;
    const edit = await app.call("PATCH", `/api/equipment/${id}`, { token: technician, body: { notes: "x" } });
    assert.equal(edit.status, 403);
  });

  it("rejects a duplicate serial number", async () => {
    const r = await app.call("POST", "/api/equipment", { token: manager, body: { ...pump, serialNumber: "ECG-001" } });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "SERIAL_EXISTS");
  });

  it("validates input", async () => {
    const missing = await app.call("POST", "/api/equipment", { token: manager, body: { name: "No serial" } });
    assert.equal(missing.status, 400);
    const badDate = await app.call("POST", "/api/equipment", {
      token: manager,
      body: { ...pump, installedOn: "2026-13-45" },
    });
    assert.equal(badDate.status, 400);
    const badStatus = await app.call("POST", "/api/equipment", {
      token: manager,
      body: { ...pump, status: "broken-ish" },
    });
    assert.equal(badStatus.status, 400);
  });

  it("lists, filters by status and department, and searches", async () => {
    await app.call("POST", "/api/equipment", {
      token: manager,
      body: { ...pump, status: "out_of_service", installedOn: "2024-03-01" },
    });
    const all = await app.call("GET", "/api/equipment", { token: technician });
    assert.equal(all.body.data.length, 2);
    const down = await app.call("GET", "/api/equipment?status=out_of_service", { token: technician });
    assert.deepEqual(down.body.data.map((e: any) => e.serialNumber), ["INF-100"]);
    const dept = await app.call("GET", "/api/equipment?department=cardiology", { token: technician });
    assert.deepEqual(dept.body.data.map((e: any) => e.serialNumber), ["ECG-001"]);
    const search = await app.call("GET", "/api/equipment?q=infusafe", { token: technician });
    assert.deepEqual(search.body.data.map((e: any) => e.serialNumber), ["INF-100"]);
    const none = await app.call("GET", "/api/equipment?q=%25", { token: technician });
    assert.equal(none.body.data.length, 0, "a % in the search is literal, not a wildcard");
  });

  it("updates an item and clears optional fields with null", async () => {
    const list = await app.call("GET", "/api/equipment?q=INF-100", { token: manager });
    const id = list.body.data[0].id;
    const r = await app.call("PATCH", `/api/equipment/${id}`, {
      token: manager,
      body: { status: "under_maintenance", installedOn: null },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, "under_maintenance");
    assert.equal(r.body.data.installedOn, null);
  });

  it("refuses an empty update and a serial that belongs to another item", async () => {
    const list = await app.call("GET", "/api/equipment?q=INF-100", { token: manager });
    const id = list.body.data[0].id;
    assert.equal((await app.call("PATCH", `/api/equipment/${id}`, { token: manager, body: {} })).status, 400);
    const clash = await app.call("PATCH", `/api/equipment/${id}`, { token: manager, body: { serialNumber: "ECG-001" } });
    assert.equal(clash.status, 409);
  });

  it("returns 404 for an unknown id and 400 for a malformed one", async () => {
    const missing = await app.call("GET", "/api/equipment/00000000-0000-4000-8000-000000000000", { token: manager });
    assert.equal(missing.status, 404);
    assert.equal((await app.call("GET", "/api/equipment/not-a-uuid", { token: manager })).status, 400);
    const patch404 = await app.call("PATCH", "/api/equipment/00000000-0000-4000-8000-000000000000", {
      token: manager,
      body: { notes: "x" },
    });
    assert.equal(patch404.status, 404);
  });
});
