export interface Config {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptCost: number;
  frontendUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.startsWith("replace-with")) {
    throw new Error("JWT_SECRET is missing. Set it in backend/.env.local");
  }
  return {
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? "1h",
    bcryptCost: 10,
    frontendUrl: env.FRONTEND_URL,
  };
}
