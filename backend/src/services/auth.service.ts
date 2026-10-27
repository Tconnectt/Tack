import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { users } from "../db/schema.ts";
import { signToken } from "../middleware/auth.ts";
import { AppError, isUniqueViolation } from "../utils/http.ts";

function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function register(
  db: Db,
  config: Config,
  input: { name: string; email: string; password: string },
) {
  const passwordHash = await bcrypt.hash(input.password, config.bcryptCost);
  try {
    // The lock makes "count users, then insert" atomic, so two simultaneous first sign-ups
    // cannot both become manager.
    const user = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(727001)`);
      const [{ total }] = await tx.select({ total: count() }).from(users);
      const role = total === 0 ? "manager" : "technician";
      const [created] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, passwordHash, role })
        .returning();
      return created;
    });
    return { user: publicUser(user), token: signToken(config, { userId: user.id, role: user.role }) };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
    throw err;
  }
}

export async function login(db: Db, config: Config, input: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw new AppError(401, "Email or password is incorrect", "INVALID_CREDENTIALS");
  return { user: publicUser(user), token: signToken(config, { userId: user.id, role: user.role }) };
}

export async function getUser(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(401, "Sign in to continue", "UNAUTHORIZED");
  return publicUser(user);
}
