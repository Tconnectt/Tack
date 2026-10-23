// Entry point for the Vercel serverless deployment. It exports the Express app
// instead of calling listen(). `npm run bundle` compiles it to api/index.js.
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");

const { db } = createDb(databaseUrl);
export default createApp(db, loadConfig());
