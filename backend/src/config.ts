import { createGoogleVerifier, type GoogleVerifier } from "./services/google.ts";

export interface Config {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptCost: number;
  frontendUrl?: string;
  /** IANA timezone used to decide what "today" is. */
  timezone: string;
  /** Limits sign-in and registration attempts per IP. Left out in most tests. */
  authRateLimit?: { windowMs: number; max: number };
  /** Set when GOOGLE_CLIENT_ID is configured. Without it the Google route answers 501. */
  googleVerifier?: GoogleVerifier;
  /** Injectable clock, used by tests. */
  now?: () => Date;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.startsWith("replace-with")) {
    throw new Error("JWT_SECRET is missing. Set it in backend/.env.local");
  }
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET is too short. Use at least 32 characters (see .env.example)");
  }
  return {
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? "1h",
    bcryptCost: 10,
    frontendUrl: env.FRONTEND_URL,
    timezone: env.TIMEZONE ?? "Africa/Lagos",
    authRateLimit: { windowMs: 15 * 60 * 1000, max: 20 },
    googleVerifier: env.GOOGLE_CLIENT_ID ? createGoogleVerifier(env.GOOGLE_CLIENT_ID) : undefined,
  };
}
