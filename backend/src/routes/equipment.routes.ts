import { Router } from "express";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import * as svc from "../services/equipment.service.ts";
import {
  createEquipmentSchema,
  idParamsSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from "../validators/equipment.validator.ts";
import { ok } from "../utils/http.ts";

export function equipmentRoutes(db: Db, config: Config) {
  const r = Router();
  r.use(requireAuth(config));

  r.get("/", async (req, res) => {
    const filters = listEquipmentQuerySchema.parse(req.query);
    ok(res, await svc.listEquipment(db, filters));
  });
  r.get("/:id", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    ok(res, await svc.getEquipment(db, id));
  });
  r.post("/", requireRole("manager"), async (req, res) => {
    const input = createEquipmentSchema.parse(req.body);
    ok(res, await svc.createEquipment(db, input), "Equipment added", 201);
  });
  r.patch("/:id", requireRole("manager"), async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const patch = updateEquipmentSchema.parse(req.body);
    ok(res, await svc.updateEquipment(db, id, patch), "Equipment updated");
  });
  return r;
}
