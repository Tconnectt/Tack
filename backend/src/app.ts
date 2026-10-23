import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import type { Config } from "./config.ts";
import type { Db } from "./db/types.ts";
import { authRoutes } from "./routes/auth.routes.ts";
import { dashboardRoutes } from "./routes/dashboard.routes.ts";
import { equipmentRoutes } from "./routes/equipment.routes.ts";
import { AppError } from "./utils/http.ts";

export function createApp(db: Db, config: Config) {
  const app = express();
  app.use(cors({ origin: config.frontendUrl ?? true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "OK", data: null });
  });
  app.use("/api/auth", authRoutes(db, config));
  app.use("/api/equipment", equipmentRoutes(db, config));
  app.use("/api/dashboard", dashboardRoutes(db, config));

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Check the highlighted fields",
        code: "VALIDATION_ERROR",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ success: false, message: err.message, code: err.code });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ success: false, message: "Invalid JSON body", code: "BAD_JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  });

  return app;
}
