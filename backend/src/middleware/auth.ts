import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Config } from "../config.ts";
import type { UserRole } from "../db/schema.ts";
import { AppError } from "../utils/http.ts";

export interface AuthUser {
  userId: string;
  role: UserRole;
}

export function signToken(config: Config, user: AuthUser): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.userId,
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function requireAuth(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Sign in to continue", "UNAUTHORIZED");
    }
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
      if (!payload.sub || (payload.role !== "manager" && payload.role !== "technician")) {
        throw new Error("bad payload");
      }
      res.locals.user = { userId: payload.sub, role: payload.role } satisfies AuthUser;
      next();
    } catch {
      throw new AppError(401, "Your session has expired. Sign in again", "UNAUTHORIZED");
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new AppError(403, "You do not have permission to do this", "FORBIDDEN");
    }
    next();
  };
}
