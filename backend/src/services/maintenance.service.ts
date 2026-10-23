import { desc, eq } from "drizzle-orm";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { equipment, maintenanceLogs, users, type EquipmentStatus, type MaintenanceType } from "../db/schema.ts";
import { todayIn } from "../utils/dates.ts";
import { AppError } from "../utils/http.ts";

export interface LogInput {
  performedOn: string;
  type: MaintenanceType;
  description: string;
  partsUsed?: string;
  setStatus?: EquipmentStatus;
}

const logColumns = {
  id: maintenanceLogs.id,
  equipmentId: maintenanceLogs.equipmentId,
  performedOn: maintenanceLogs.performedOn,
  type: maintenanceLogs.type,
  description: maintenanceLogs.description,
  partsUsed: maintenanceLogs.partsUsed,
  performedByName: users.name,
  createdAt: maintenanceLogs.createdAt,
};

async function assertEquipmentExists(db: Db, id: string) {
  const [row] = await db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, id)).limit(1);
  if (!row) throw new AppError(404, "Equipment not found", "NOT_FOUND");
}

export async function listLogs(db: Db, equipmentId: string) {
  await assertEquipmentExists(db, equipmentId);
  return db
    .select(logColumns)
    .from(maintenanceLogs)
    .innerJoin(users, eq(users.id, maintenanceLogs.performedBy))
    .where(eq(maintenanceLogs.equipmentId, equipmentId))
    .orderBy(desc(maintenanceLogs.performedOn), desc(maintenanceLogs.createdAt));
}

export async function addLog(db: Db, config: Config, equipmentId: string, userId: string, input: LogInput) {
  await assertEquipmentExists(db, equipmentId);
  if (input.performedOn > todayIn(config)) {
    throw new AppError(400, "The service date cannot be in the future", "DATE_IN_FUTURE");
  }
  // The log and the optional status change succeed or fail together.
  const id = await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(maintenanceLogs)
      .values({
        equipmentId,
        performedOn: input.performedOn,
        type: input.type,
        description: input.description,
        partsUsed: input.partsUsed,
        performedBy: userId,
      })
      .returning({ id: maintenanceLogs.id });
    if (input.setStatus) {
      await tx.update(equipment).set({ status: input.setStatus, updatedAt: new Date() }).where(eq(equipment.id, equipmentId));
    }
    return log.id;
  });
  const [row] = await db
    .select(logColumns)
    .from(maintenanceLogs)
    .innerJoin(users, eq(users.id, maintenanceLogs.performedBy))
    .where(eq(maintenanceLogs.id, id));
  return row;
}

export async function recentLogs(db: Db, limit: number) {
  return db
    .select({ ...logColumns, equipmentName: equipment.name })
    .from(maintenanceLogs)
    .innerJoin(users, eq(users.id, maintenanceLogs.performedBy))
    .innerJoin(equipment, eq(equipment.id, maintenanceLogs.equipmentId))
    .orderBy(desc(maintenanceLogs.performedOn), desc(maintenanceLogs.createdAt))
    .limit(limit);
}
