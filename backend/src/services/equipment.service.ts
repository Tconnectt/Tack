import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "../db/types.ts";
import { equipment, type EquipmentStatus } from "../db/schema.ts";
import { AppError, isUniqueViolation } from "../utils/http.ts";

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface ListFilters {
  status?: EquipmentStatus;
  department?: string;
  q?: string;
}

export async function listEquipment(db: Db, f: ListFilters) {
  const conds = [];
  if (f.status) conds.push(eq(equipment.status, f.status));
  if (f.department) conds.push(ilike(equipment.department, escapeLike(f.department)));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    conds.push(or(ilike(equipment.name, like), ilike(equipment.model, like), ilike(equipment.serialNumber, like)));
  }
  return db
    .select()
    .from(equipment)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(equipment.name), asc(equipment.serialNumber));
}

export async function getEquipment(db: Db, id: string) {
  const [row] = await db.select().from(equipment).where(eq(equipment.id, id)).limit(1);
  if (!row) throw new AppError(404, "Equipment not found", "NOT_FOUND");
  return row;
}

export async function createEquipment(db: Db, input: typeof equipment.$inferInsert) {
  try {
    const [row] = await db.insert(equipment).values(input).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}

export async function updateEquipment(db: Db, id: string, patch: Partial<typeof equipment.$inferInsert>) {
  try {
    const [row] = await db
      .update(equipment)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    if (!row) throw new AppError(404, "Equipment not found", "NOT_FOUND");
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    throw err;
  }
}
