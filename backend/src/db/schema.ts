import { date, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["manager", "technician"]);
export const equipmentStatus = pgEnum("equipment_status", [
  "in_service",
  "under_maintenance",
  "out_of_service",
  "retired",
]);

export const maintenanceType = pgEnum("maintenance_type", [
  "preventive",
  "corrective",
  "inspection",
  "calibration",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  // Null for accounts that only sign in with Google.
  passwordHash: text("password_hash"),
  googleSub: text("google_sub").unique(),
  role: userRole("role").notNull().default("technician"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  model: text("model"),
  serialNumber: text("serial_number").notNull(),
  department: text("department").notNull(),
  status: equipmentStatus("status").notNull().default("in_service"),
  installedOn: date("installed_on", { mode: "string" }),
  serviceIntervalDays: integer("service_interval_days"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = (typeof userRole.enumValues)[number];
export type EquipmentStatus = (typeof equipmentStatus.enumValues)[number];

export const maintenanceLogs = pgTable("maintenance_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "restrict" }),
  performedOn: date("performed_on", { mode: "string" }).notNull(),
  type: maintenanceType("type").notNull(),
  description: text("description").notNull(),
  partsUsed: text("parts_used"),
  performedBy: uuid("performed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MaintenanceType = (typeof maintenanceType.enumValues)[number];

// Only these kinds of work reset the service schedule.
export const SCHEDULED_TYPES: MaintenanceType[] = ["preventive", "calibration"];

export type EquipmentEventKind = "created" | "updated" | "status_changed";
export interface EventChange {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export const equipmentEvents = pgTable("equipment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  equipmentId: uuid("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "restrict" }),
  // Null for entries created before history tracking existed.
  actorId: uuid("actor_id").references(() => users.id),
  kind: text("kind").$type<EquipmentEventKind>().notNull(),
  changes: jsonb("changes").$type<EventChange[]>().notNull().default([]),
  logId: uuid("log_id").references(() => maintenanceLogs.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
