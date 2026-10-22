import { readdirSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createApp } from "../src/app.ts";
import type { Config } from "../src/config.ts";
import * as schema from "../src/db/schema.ts";

const migrationsDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "drizzle");

export const testConfig: Config = {
  jwtSecret: "test-secret",
  jwtExpiresIn: "1h",
  bcryptCost: 4,
  timezone: "Africa/Lagos",
};

export async function startTestApp(opts: { now?: () => Date } = {}) {
  const client = new PGlite();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  const db = drizzle(client, { schema });
  const server = createApp(db, { ...testConfig, now: opts.now }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    return { status: res.status, body: (await res.json()) as any };
  }

  async function signUp(name: string, email: string) {
    const r = await call("POST", "/api/auth/register", { body: { name, email, password: "password123" } });
    return { token: r.body.data.token as string, user: r.body.data.user };
  }

  return {
    db,
    call,
    signUp,
    async close() {
      await new Promise((r) => server.close(r));
      await client.close();
    },
  };
}
