import { and, asc, eq, ilike, inArray, max, or } from "drizzle-orm";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { equipment, maintenanceLogs, SCHEDULED_TYPES, type EquipmentStatus } from "../db/schema.ts";
import { todayIn } from "../utils/dates.ts";
import { AppError, isUniqueViolation } from "../utils/http.ts";
import { computeSchedule } from "./schedule.ts";

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface ListFilters {
  status?: EquipmentStatus;
  department?: string;
  q?: string;
}

function lastScheduledService(db: Db) {
  return db
    .select({ equipmentId: maintenanceLogs.equipmentId, lastOn: max(maintenanceLogs.performedOn).as("last_on") })
    .from(maintenanceLogs)
    .where(inArray(maintenanceLogs.type, SCHEDULED_TYPES))
    .groupBy(maintenanceLogs.equipmentId)
    .as("last_scheduled");
}

async function selectWithSchedule(db: Db, config: Config, where: ReturnType<typeof and>) {
  const last = lastScheduledService(db);
  const rows = await db
    .select({ item: equipment, lastServicedOn: last.lastOn })
    .from(equipment)
    .leftJoin(last, eq(equipment.id, last.equipmentId))
    .where(where)
    .orderBy(asc(equipment.name), asc(equipment.serialNumber));
  const today = todayIn(config);
  return rows.map((r) => ({ ...r.item, ...computeSchedule(r.item, r.lastServicedOn ?? null, today, config.timezone) }));
}

export type EquipmentWithSchedule = Awaited<ReturnType<typeof selectWithSchedule>>[number];

export async function listEquipment(db: Db, config: Config, f: ListFilters) {
  const conds = [];
  if (f.status) conds.push(eq(equipment.status, f.status));
  if (f.department) conds.push(ilike(equipment.department, escapeLike(f.department)));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    conds.push(or(ilike(equipment.name, like), ilike(equipment.model, like), ilike(equipment.serialNumber, like)));
  }
  return selectWithSchedule(db, config, conds.length ? and(...conds) : undefined);
}

export async function getEquipment(db: Db, config: Config, id: string) {
  const [row] = await selectWithSchedule(db, config, eq(equipment.id, id));
  if (!row) throw new AppError(404, "Equipment not found", "NOT_FOUND");
  return row;
}

export async function createEquipment(db: Db, config: Config, input: typeof equipment.$inferInsert) {
  try {
    const [row] = await db.insert(equipment).values(input).returning({ id: equipment.id });
    return getEquipment(db, config, row.id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}

export async function updateEquipment(
  db: Db,
  config: Config,
  id: string,
  patch: Partial<typeof equipment.$inferInsert>,
) {
  try {
    const [row] = await db
      .update(equipment)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning({ id: equipment.id });
    if (!row) throw new AppError(404, "Equipment not found", "NOT_FOUND");
    return getEquipment(db, config, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}
