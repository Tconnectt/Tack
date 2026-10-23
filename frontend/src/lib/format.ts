import type { DueStatus, EquipmentStatus, MaintenanceType } from "./types.ts";

export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_service: "In service",
  under_maintenance: "Under maintenance",
  out_of_service: "Out of service",
  retired: "Retired",
};

export const TYPE_LABELS: Record<MaintenanceType, string> = {
  preventive: "Preventive maintenance",
  corrective: "Repair",
  inspection: "Inspection",
  calibration: "Calibration",
};

const DUE_LABELS: Record<DueStatus, string> = {
  ok: "On schedule",
  due_soon: "Due soon",
  overdue: "Overdue",
  no_schedule: "No schedule",
};

export function dueLabel(status: DueStatus): string {
  return DUE_LABELS[status];
}

/** "22 Oct 2026" from "2026-10-22". Empty string for null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Plain-language due text for an equipment row. */
export function dueText(item: { dueStatus: DueStatus; daysUntilDue: number | null }): string {
  if (item.dueStatus === "no_schedule" || item.daysUntilDue === null) return "No service schedule";
  if (item.daysUntilDue < 0) return `Overdue by ${days(-item.daysUntilDue)}`;
  if (item.daysUntilDue === 0) return "Due today";
  return `Due in ${days(item.daysUntilDue)}`;
}

/** YYYY-MM-DD for an instant in an IANA timezone. */
export function todayInZone(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
