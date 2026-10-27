import type { DueStatus, EquipmentEvent, EquipmentStatus, EventChange, MaintenanceType } from "./types.ts";

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

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  model: "Model",
  serialNumber: "Serial number",
  department: "Department",
  status: "Status",
  installedOn: "Installed on",
  serviceIntervalDays: "Service interval (days)",
  notes: "Notes",
};

function showValue(field: string, value: EventChange["from"]): string {
  if (value === null || value === "") return "empty";
  if (field === "status") return STATUS_LABELS[value as EquipmentStatus] ?? String(value);
  if (field === "installedOn") return formatDate(String(value));
  if (field === "notes") return "text";
  return String(value);
}

/** One readable line per change, for the history timeline. */
export function describeChange(c: EventChange): string {
  const label = FIELD_LABELS[c.field] ?? c.field;
  if (c.field === "notes") return c.to === null || c.to === "" ? "Notes removed" : c.from ? "Notes edited" : "Notes added";
  return `${label}: ${showValue(c.field, c.from)} to ${showValue(c.field, c.to)}`;
}

export function describeEvent(e: Pick<EquipmentEvent, "kind" | "changes" | "actorName">): string[] {
  if (e.kind === "created") return [e.actorName ? "Added to the register" : "Added to the register (before history tracking)"];
  if (e.kind === "status_changed") return e.changes.map((c) => `Status changed through a service record. ${describeChange(c)}`);
  return e.changes.map(describeChange);
}

/** "22 Oct 2026, 14:05" in the given timezone. */
export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  })
    .format(new Date(iso))
    .replace(" at ", ", ");
}
