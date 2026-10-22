import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "./schema.ts";

// Works with both node-postgres (production) and PGlite (tests).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
