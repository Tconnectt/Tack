import { Router } from "express";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { requireAuth } from "../middleware/auth.ts";
import { getDashboard } from "../services/dashboard.service.ts";
import { ok } from "../utils/http.ts";

export function dashboardRoutes(db: Db, config: Config) {
  const r = Router();
  r.use(requireAuth(config));
  r.get("/", async (_req, res) => {
    ok(res, await getDashboard(db, config));
  });
  return r;
}
