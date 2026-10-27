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

type NewUser = { name: string; email: string; passwordHash: string | null; googleSub?: string };

// The lock makes "count users, then insert" atomic, so two simultaneous first sign-ups
// cannot both become manager.
async function createUser(db: Db, input: NewUser) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727001)`);
    const [{ total }] = await tx.select({ total: count() }).from(users);
    const role = total === 0 ? "manager" : "technician";
    const [created] = await tx.insert(users).values({ ...input, role }).returning();
    return created;
  });
}

export async function register(
  db: Db,
  config: Config,
  input: { name: string; email: string; password: string },
) {
  const passwordHash = await bcrypt.hash(input.password, config.bcryptCost);
  try {
    const user = await createUser(db, { name: input.name, email: input.email, passwordHash });
    return { user: publicUser(user), token: signToken(config, { userId: user.id, role: user.role }) };
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
    throw err;
  }
}

export async function loginWithGoogle(db: Db, config: Config, credential: string) {
  if (!config.googleVerifier) throw new AppError(501, "Google sign-in is not set up on this server", "GOOGLE_NOT_CONFIGURED");
  let profile;
  try {
    profile = await config.googleVerifier(credential);
  } catch {
    throw new AppError(401, "Google sign-in failed. Try again", "GOOGLE_INVALID");
  }
  if (!profile.emailVerified) throw new AppError(401, "Your Google email is not verified", "GOOGLE_INVALID");

  const [bySub] = await db.select().from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  let user = bySub;
  if (!user) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (byEmail) {
      // Same verified email as an existing account: link them instead of making a duplicate.
      [user] = await db.update(users).set({ googleSub: profile.sub }).where(eq(users.id, byEmail.id)).returning();
    } else {
      try {
        user = await createUser(db, { name: profile.name, email: profile.email, passwordHash: null, googleSub: profile.sub });
      } catch (err) {
        if (isUniqueViolation(err)) throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
        throw err;
      }
    }
  }
  return { user: publicUser(user), token: signToken(config, { userId: user.id, role: user.role }) };
}

export async function login(db: Db, config: Config, input: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  // Google-only accounts have no password, so they can never match here.
  const valid = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw new AppError(401, "Email or password is incorrect", "INVALID_CREDENTIALS");
  return { user: publicUser(user), token: signToken(config, { userId: user.id, role: user.role }) };
}

export async function getUser(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(401, "Sign in to continue", "UNAUTHORIZED");
  return publicUser(user);
}
