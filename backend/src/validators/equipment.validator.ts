import { z } from "zod";
import { equipmentStatus } from "../db/schema.ts";

const text = (max: number) => z.string().trim().min(1).max(max);

export const createEquipmentSchema = z.object({
  name: text(120),
  model: text(120).optional(),
  serialNumber: text(80),
  department: text(80),
  status: z.enum(equipmentStatus.enumValues).optional(),
  installedOn: z.iso.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateEquipmentSchema = z
  .object({
    name: text(120),
    model: text(120).nullable(),
    serialNumber: text(80),
    department: text(80),
    status: z.enum(equipmentStatus.enumValues),
    installedOn: z.iso.date().nullable(),
    notes: z.string().trim().max(1000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Send at least one field to update" });

export const listEquipmentQuerySchema = z.object({
  status: z.enum(equipmentStatus.enumValues).optional(),
  department: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

export const idParamsSchema = z.object({ id: z.uuid() });
