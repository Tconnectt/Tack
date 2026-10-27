// Post-deploy check against a running API.
// Usage: npm run smoke -- https://tack-api.vercel.app
// It checks the health endpoint (which tests the database) and the demo manager login.
const base = (process.argv[2] ?? process.env.API_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: npm run smoke -- <api url>");
  process.exit(2);
}
const email = process.env.SMOKE_EMAIL ?? "manager@tack-demo.dev";
const password = process.env.SMOKE_PASSWORD ?? "TackDemo2026!";

let failed = false;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed = true;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

async function json(path, init) {
  const res = await fetch(base + path, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

let token;
await check("health reports the database is up", async () => {
  const r = await json("/api/health");
  if (r.status !== 200 || r.body?.data?.database !== "up") throw new Error(`status ${r.status}, ${JSON.stringify(r.body)}`);
});
await check("demo manager can sign in", async () => {
  const r = await json("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200 || !r.body?.data?.token) throw new Error(`status ${r.status}, ${r.body?.message}`);
  token = r.body.data.token;
});
await check("dashboard loads with the token", async () => {
  const r = await json("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } });
  if (r.status !== 200) throw new Error(`status ${r.status}, ${r.body?.message}`);
});
await check("a wrong password is refused, not a server error", async () => {
  const r = await json("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "definitely-wrong" }),
  });
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
});

process.exit(failed ? 1 : 0);
