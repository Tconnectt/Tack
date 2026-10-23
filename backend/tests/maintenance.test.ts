import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestApp } from "./helpers.ts";

// Fixed "now": 22 October 2026, midday in Lagos.
const NOW = new Date("2026-10-22T11:00:00Z");

describe("maintenance and dashboard", () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let manager: string;
  let technician: string;

  async function add(body: Record<string, unknown>) {
    const r = await app.call("POST", "/api/equipment", { token: manager, body });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data;
  }
  const log = (id: string, body: Record<string, unknown>, token = technician) =>
    app.call("POST", `/api/equipment/${id}/maintenance`, { token, body });

  before(async () => {
    app = await startTestApp({ now: () => NOW });
    manager = (await app.signUp("Ada Manager", "ada@example.com")).token;
    technician = (await app.signUp("Tunde Tech", "tunde@example.com")).token;
  });
  after(() => app.close());

  it("marks equipment overdue when the interval has passed since install", async () => {
    const e = await add({ name: "ECG", serialNumber: "S-1", department: "Cardiology", installedOn: "2026-01-01", serviceIntervalDays: 90 });
    assert.equal(e.nextDueOn, "2026-04-01");
    assert.equal(e.dueStatus, "overdue");
    assert.equal(e.daysUntilDue, -204);
    assert.equal(e.lastServicedOn, null);
  });

  it("a preventive service restarts the clock", async () => {
    const e = await add({ name: "Monitor", serialNumber: "S-2", department: "ICU", installedOn: "2026-01-01", serviceIntervalDays: 90 });
    const r = await log(e.id, { performedOn: "2026-10-01", type: "preventive", description: "Cleaned and tested alarms" });
    assert.equal(r.status, 201);
    const after = (await app.call("GET", `/api/equipment/${e.id}`, { token: technician })).body.data;
    assert.equal(after.lastServicedOn, "2026-10-01");
    assert.equal(after.nextDueOn, "2026-12-30");
    assert.equal(after.dueStatus, "ok");
  });

  it("calibration also restarts the clock, repairs and inspections do not", async () => {
    const e = await add({ name: "Spirometer", serialNumber: "S-3", department: "Ward B", installedOn: "2026-01-01", serviceIntervalDays: 90 });
    await log(e.id, { performedOn: "2026-10-10", type: "corrective", description: "Replaced mouthpiece" });
    await log(e.id, { performedOn: "2026-10-11", type: "inspection", description: "Visual check" });
    let cur = (await app.call("GET", `/api/equipment/${e.id}`, { token: manager })).body.data;
    assert.equal(cur.dueStatus, "overdue");
    assert.equal(cur.lastServicedOn, null);
    await log(e.id, { performedOn: "2026-10-12", type: "calibration", description: "Calibrated against reference" });
    cur = (await app.call("GET", `/api/equipment/${e.id}`, { token: manager })).body.data;
    assert.equal(cur.lastServicedOn, "2026-10-12");
    assert.equal(cur.dueStatus, "ok");
  });

  it("flags equipment due within 14 days as due soon", async () => {
    const soon = await add({ name: "Suction", serialNumber: "S-4", department: "Theatre", installedOn: "2026-10-01", serviceIntervalDays: 30 });
    assert.equal(soon.nextDueOn, "2026-10-31");
    assert.equal(soon.daysUntilDue, 9);
    assert.equal(soon.dueStatus, "due_soon");
    const edge = await add({ name: "Edge", serialNumber: "S-5", department: "Theatre", installedOn: "2026-10-06", serviceIntervalDays: 30 });
    assert.equal(edge.daysUntilDue, 14);
    assert.equal(edge.dueStatus, "due_soon");
    const outside = await add({ name: "Outside", serialNumber: "S-6", department: "Theatre", installedOn: "2026-10-07", serviceIntervalDays: 30 });
    assert.equal(outside.daysUntilDue, 15);
    assert.equal(outside.dueStatus, "ok");
  });

  it("has no schedule without an interval, and retired items never come due", async () => {
    const none = await add({ name: "Trolley", serialNumber: "S-7", department: "Ward A" });
    assert.equal(none.dueStatus, "no_schedule");
    assert.equal(none.nextDueOn, null);
    const retired = await add({ name: "Old X-ray", serialNumber: "S-8", department: "Radiology", installedOn: "2010-01-01", serviceIntervalDays: 30, status: "retired" });
    assert.equal(retired.dueStatus, "no_schedule");
  });

  it("uses the date the item was added when there is no install date or service", async () => {
    const e = await add({ name: "Nebuliser", serialNumber: "S-9", department: "Ward A", serviceIntervalDays: 10 });
    const created = new Date(e.createdAt).toISOString().slice(0, 10);
    const expected = new Date(Date.parse(created) + 10 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(e.nextDueOn, expected);
  });

  it("lets technicians record work, stores who did it, and lists newest first", async () => {
    const e = await add({ name: "Pump", serialNumber: "S-10", department: "Ward A" });
    await log(e.id, { performedOn: "2026-09-01", type: "preventive", description: "First service", partsUsed: "Tubing set" });
    const second = await log(e.id, { performedOn: "2026-10-15", type: "corrective", description: "Fixed door latch" }, manager);
    assert.equal(second.body.data.performedByName, "Ada Manager");
    const list = await app.call("GET", `/api/equipment/${e.id}/maintenance`, { token: technician });
    assert.deepEqual(list.body.data.map((l: any) => l.performedOn), ["2026-10-15", "2026-09-01"]);
    assert.equal(list.body.data[1].performedByName, "Tunde Tech");
    assert.equal(list.body.data[1].partsUsed, "Tubing set");
  });

  it("changes the equipment status together with the log when asked", async () => {
    const e = await add({ name: "Dialysis", serialNumber: "S-11", department: "Renal" });
    const r = await log(e.id, { performedOn: "2026-10-20", type: "corrective", description: "Pump failure, waiting for part", setStatus: "out_of_service" });
    assert.equal(r.status, 201);
    const cur = (await app.call("GET", `/api/equipment/${e.id}`, { token: manager })).body.data;
    assert.equal(cur.status, "out_of_service");
  });

  it("rejects future dates, bad input and unknown equipment", async () => {
    const e = await add({ name: "Lamp", serialNumber: "S-12", department: "Theatre" });
    const future = await log(e.id, { performedOn: "2026-10-23", type: "preventive", description: "Planned" });
    assert.equal(future.status, 400);
    assert.equal(future.body.code, "DATE_IN_FUTURE");
    assert.equal((await log(e.id, { performedOn: "2026-10-22", type: "preventive", description: "Today is fine" })).status, 201);
    assert.equal((await log(e.id, { performedOn: "2026-10-01", type: "nonsense", description: "Bad type" })).status, 400);
    assert.equal((await log(e.id, { performedOn: "2026-10-01", type: "preventive", description: "x" })).status, 400);
    const ghost = "00000000-0000-4000-8000-000000000000";
    assert.equal((await log(ghost, { performedOn: "2026-10-01", type: "preventive", description: "Nobody home" })).status, 404);
    assert.equal((await app.call("GET", `/api/equipment/${ghost}/maintenance`, { token: manager })).status, 404);
  });

  it("validates the service interval", async () => {
    for (const bad of [0, -5, 1.5, 4000]) {
      const r = await app.call("POST", "/api/equipment", {
        token: manager,
        body: { name: "Bad", serialNumber: `BAD-${bad}`, department: "X", serviceIntervalDays: bad },
      });
      assert.equal(r.status, 400, `interval ${bad}`);
    }
    const e = await add({ name: "Settable", serialNumber: "S-13", department: "X", serviceIntervalDays: 30 });
    const cleared = await app.call("PATCH", `/api/equipment/${e.id}`, { token: manager, body: { serviceIntervalDays: null } });
    assert.equal(cleared.body.data.dueStatus, "no_schedule");
  });

  it("requires sign-in for maintenance and the dashboard", async () => {
    assert.equal((await app.call("GET", "/api/dashboard")).status, 401);
    const e = await add({ name: "Auth check", serialNumber: "S-14", department: "X" });
    assert.equal((await app.call("POST", `/api/equipment/${e.id}/maintenance`, { body: {} })).status, 401);
  });

  it("summarises the dashboard: totals, overdue and due soon sorted by date, recent work", async () => {
    const d = (await app.call("GET", "/api/dashboard", { token: technician })).body.data;
    assert.equal(d.totals.total, 14);
    assert.equal(d.totals.retired, 1);
    assert.equal(d.totals.outOfService, 1);
    const overdueSerials = d.overdue.map((e: any) => e.serialNumber);
    assert.ok(overdueSerials.includes("S-1") && overdueSerials.includes("S-3") === false);
    const dates = d.overdue.map((e: any) => e.nextDueOn);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(d.overdue.every((e: any) => e.dueStatus === "overdue"));
    assert.ok(d.dueSoon.every((e: any) => e.dueStatus === "due_soon"));
    assert.ok(d.dueSoon.map((e: any) => e.serialNumber).includes("S-4"));
    assert.ok(!overdueSerials.includes("S-8"), "retired items are not listed as overdue");
    assert.equal(d.recentLogs.length, 5);
    const logDates = d.recentLogs.map((l: any) => l.performedOn);
    assert.deepEqual(logDates, [...logDates].sort().reverse());
    assert.ok(d.recentLogs[0].equipmentName);
  });
});
