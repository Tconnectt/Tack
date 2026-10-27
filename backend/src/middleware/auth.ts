import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import type { Config } from "../config.ts";
import { users, type UserRole } from "../db/schema.ts";
import type { Db } from "../db/types.ts";
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

// The token only proves who the user is. Their role is read from the database on every
// request, so a demotion or deleted account takes effect immediately.
export function requireAuth(db: Db, config: Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Sign in to continue", "UNAUTHORIZED");
    }
    let userId: string;
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
      if (!payload.sub) throw new Error("bad payload");
      userId = payload.sub;
    } catch {
      throw new AppError(401, "Your session has expired. Sign in again", "UNAUTHORIZED");
    }
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new AppError(401, "Your session has expired. Sign in again", "UNAUTHORIZED");
    res.locals.user = { userId: user.id, role: user.role } satisfies AuthUser;
    next();
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
