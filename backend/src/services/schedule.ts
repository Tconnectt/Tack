import type { equipment } from "../db/schema.ts";
import { addDays, dateInZone, daysBetween } from "../utils/dates.ts";

export const DUE_SOON_DAYS = 14;

export type DueStatus = "ok" | "due_soon" | "overdue" | "no_schedule";

export interface ScheduleInfo {
  lastServicedOn: string | null;
  nextDueOn: string | null;
  daysUntilDue: number | null;
  dueStatus: DueStatus;
}

export function computeSchedule(
  row: typeof equipment.$inferSelect,
  lastServicedOn: string | null,
  today: string,
  timeZone: string,
): ScheduleInfo {
  if (row.status === "retired" || !row.serviceIntervalDays) {
    return { lastServicedOn, nextDueOn: null, daysUntilDue: null, dueStatus: "no_schedule" };
  }
  // The clock starts at the last scheduled service, else the install date, else when it was added.
  const baseline = lastServicedOn ?? row.installedOn ?? dateInZone(row.createdAt, timeZone);
  const nextDueOn = addDays(baseline, row.serviceIntervalDays);
  const daysUntilDue = daysBetween(today, nextDueOn);
  const dueStatus: DueStatus = daysUntilDue < 0 ? "overdue" : daysUntilDue <= DUE_SOON_DAYS ? "due_soon" : "ok";
  return { lastServicedOn, nextDueOn, daysUntilDue, dueStatus };
}
