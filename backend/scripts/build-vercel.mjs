// Builds the Vercel deployment using the Build Output API.
// Writes .vercel/output with one serverless function (the Express app) and a
// static landing page, so Vercel does not need to find the function in the source.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const out = ".vercel/output";
const fn = `${out}/functions/api.func`;

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
mkdirSync(`${out}/static`, { recursive: true });

await build({
  entryPoints: ["src/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["pg-native"],
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
  outfile: `${fn}/index.mjs`,
  logLevel: "warning",
});

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs" }),
);
cpSync("public/index.html", `${out}/static/index.html`);
writeFileSync(
  `${out}/config.json`,
  JSON.stringify({ version: 3, routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/api" }] }),
);
console.log("Built .vercel/output");
