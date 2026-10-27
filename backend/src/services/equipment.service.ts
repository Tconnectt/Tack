import { and, asc, desc, eq, ilike, inArray, max, or } from "drizzle-orm";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import {
  equipment,
  equipmentEvents,
  maintenanceLogs,
  SCHEDULED_TYPES,
  users,
  type EquipmentStatus,
  type EventChange,
} from "../db/schema.ts";
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

const TRACKED_FIELDS = [
  "name",
  "model",
  "serialNumber",
  "department",
  "status",
  "installedOn",
  "serviceIntervalDays",
  "notes",
] as const;

export async function createEquipment(db: Db, config: Config, actorId: string, input: typeof equipment.$inferInsert) {
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(equipment).values(input).returning({ id: equipment.id });
      await tx.insert(equipmentEvents).values({ equipmentId: row.id, actorId, kind: "created" });
      return row.id;
    });
    return getEquipment(db, config, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}

export async function updateEquipment(
  db: Db,
  config: Config,
  actorId: string,
  id: string,
  patch: Partial<typeof equipment.$inferInsert>,
) {
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(equipment).where(eq(equipment.id, id)).for("update");
      if (!current) throw new AppError(404, "Equipment not found", "NOT_FOUND");
      const changes: EventChange[] = [];
      for (const field of TRACKED_FIELDS) {
        if (!(field in patch)) continue;
        const to = (patch[field] ?? null) as EventChange["to"];
        const from = (current[field] ?? null) as EventChange["from"];
        if (to !== from) changes.push({ field, from, to });
      }
      await tx.update(equipment).set({ ...patch, updatedAt: new Date() }).where(eq(equipment.id, id));
      if (changes.length > 0) {
        await tx.insert(equipmentEvents).values({ equipmentId: id, actorId, kind: "updated", changes });
      }
    });
    return getEquipment(db, config, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}

export async function listHistory(db: Db, equipmentId: string) {
  const [item] = await db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, equipmentId)).limit(1);
  if (!item) throw new AppError(404, "Equipment not found", "NOT_FOUND");
  return db
    .select({
      id: equipmentEvents.id,
      kind: equipmentEvents.kind,
      changes: equipmentEvents.changes,
      logId: equipmentEvents.logId,
      actorName: users.name,
      createdAt: equipmentEvents.createdAt,
    })
    .from(equipmentEvents)
    .leftJoin(users, eq(users.id, equipmentEvents.actorId))
    .where(eq(equipmentEvents.equipmentId, equipmentId))
    .orderBy(desc(equipmentEvents.createdAt), desc(equipmentEvents.id));
}
