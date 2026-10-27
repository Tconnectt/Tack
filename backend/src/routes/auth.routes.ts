import { Router } from "express";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { requireAuth, type AuthUser } from "../middleware/auth.ts";
import * as auth from "../services/auth.service.ts";
import { loginSchema, registerSchema } from "../validators/auth.validator.ts";
import { ok } from "../utils/http.ts";

export function authRoutes(db: Db, config: Config) {
  const r = Router();
  r.post("/register", async (req, res) => {
    const input = registerSchema.parse(req.body);
    ok(res, await auth.register(db, config, input), "Account created", 201);
  });
  r.post("/login", async (req, res) => {
    const input = loginSchema.parse(req.body);
    ok(res, await auth.login(db, config, input), "Signed in");
  });
  r.get("/me", requireAuth(db, config), async (_req, res) => {
    const { userId } = res.locals.user as AuthUser;
    ok(res, await auth.getUser(db, userId));
  });
  return r;
}
