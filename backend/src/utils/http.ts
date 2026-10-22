import type { Response } from "express";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function ok(res: Response, data: unknown, message = "OK", status = 200) {
  res.status(status).json({ success: true, message, data });
}

// Postgres unique violation, whether the driver wraps the error or not.
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
