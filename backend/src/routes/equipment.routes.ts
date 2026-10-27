import { Router } from "express";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { requireAuth, requireRole, type AuthUser } from "../middleware/auth.ts";
import * as svc from "../services/equipment.service.ts";
import * as maintenance from "../services/maintenance.service.ts";
import {
  createEquipmentSchema,
  createLogSchema,
  idParamsSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from "../validators/equipment.validator.ts";
import { ok } from "../utils/http.ts";

export function equipmentRoutes(db: Db, config: Config) {
  const r = Router();
  r.use(requireAuth(db, config));

  r.get("/", async (req, res) => {
    const filters = listEquipmentQuerySchema.parse(req.query);
    ok(res, await svc.listEquipment(db, config, filters));
  });
  r.get("/:id", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    ok(res, await svc.getEquipment(db, config, id));
  });
  r.post("/", requireRole("manager"), async (req, res) => {
    const input = createEquipmentSchema.parse(req.body);
    const { userId } = res.locals.user as AuthUser;
    ok(res, await svc.createEquipment(db, config, userId, input), "Equipment added", 201);
  });
  r.patch("/:id", requireRole("manager"), async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const patch = updateEquipmentSchema.parse(req.body);
    const { userId } = res.locals.user as AuthUser;
    ok(res, await svc.updateEquipment(db, config, userId, id, patch), "Equipment updated");
  });
  r.get("/:id/history", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    ok(res, await svc.listHistory(db, id));
  });

  r.get("/:id/maintenance", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    ok(res, await maintenance.listLogs(db, id));
  });
  // Technicians and managers can both record work they did.
  r.post("/:id/maintenance", async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const input = createLogSchema.parse(req.body);
    const { userId } = res.locals.user as AuthUser;
    ok(res, await maintenance.addLog(db, config, id, userId, input), "Service recorded", 201);
  });
  return r;
}
