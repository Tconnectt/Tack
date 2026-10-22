import { date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["manager", "technician"]);
export const equipmentStatus = pgEnum("equipment_status", [
  "in_service",
  "under_maintenance",
  "out_of_service",
  "retired",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
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
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRole = (typeof userRole.enumValues)[number];
export type EquipmentStatus = (typeof equipmentStatus.enumValues)[number];
