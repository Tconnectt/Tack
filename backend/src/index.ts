import dotenv from "dotenv";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const config = loadConfig();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing. Set it in backend/.env.local");

const { db } = createDb(databaseUrl);
const port = Number(process.env.PORT ?? 5000);
createApp(db, config).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
