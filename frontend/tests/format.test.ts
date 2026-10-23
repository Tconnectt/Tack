import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueText, formatDate, todayInZone } from "../src/lib/format.ts";

describe("dueText", () => {
  it("says how overdue an item is, with correct singular and plural", () => {
    assert.equal(dueText({ dueStatus: "overdue", daysUntilDue: -1 }), "Overdue by 1 day");
    assert.equal(dueText({ dueStatus: "overdue", daysUntilDue: -204 }), "Overdue by 204 days");
  });
  it("handles today, soon and later", () => {
    assert.equal(dueText({ dueStatus: "due_soon", daysUntilDue: 0 }), "Due today");
    assert.equal(dueText({ dueStatus: "due_soon", daysUntilDue: 1 }), "Due in 1 day");
    assert.equal(dueText({ dueStatus: "ok", daysUntilDue: 45 }), "Due in 45 days");
  });
  it("says there is no schedule when there is none", () => {
    assert.equal(dueText({ dueStatus: "no_schedule", daysUntilDue: null }), "No service schedule");
  });
});

describe("formatDate", () => {
  it("formats a date without shifting it by timezone", () => {
    assert.equal(formatDate("2026-10-22"), "22 Oct 2026");
    assert.equal(formatDate("2026-01-01"), "1 Jan 2026");
  });
  it("returns an empty string for null", () => {
    assert.equal(formatDate(null), "");
  });
});

describe("todayInZone", () => {
  it("uses the given timezone, not the machine's", () => {
    const lateEveningUtc = new Date("2026-10-22T23:30:00Z");
    assert.equal(todayInZone("Africa/Lagos", lateEveningUtc), "2026-10-23");
    assert.equal(todayInZone("UTC", lateEveningUtc), "2026-10-22");
  });
});
