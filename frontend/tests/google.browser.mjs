// Browser tests for "Continue with Google". Google's script and the API are both stubbed.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "http://api.test";
process.env.VITE_API_URL = API;

const GOOGLE_STUB = `
window.google = { accounts: { id: {
  initialize(o) { window.__callback = o.callback; window.__clientId = o.client_id; },
  renderButton(el) {
    const b = document.createElement("button");
    b.textContent = "Continue with Google";
    b.onclick = () => window.__callback({ credential: "fake-google-credential-0123456789" });
    el.appendChild(b);
  },
} } };`;

const USER = { id: "u-g", name: "Grace Google", email: "grace@example.com", role: "technician" };
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

let withId;
let withoutId;
let browser;
const urlOf = (s) => s.resolvedUrls.local[0].replace(/\/$/, "");

before(async () => {
  withId = await createServer({ root, logLevel: "error", server: { port: 5197, strictPort: false }, define: { "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify("test-client.apps.googleusercontent.com") } });
  await withId.listen();
  withoutId = await createServer({ root, logLevel: "error", server: { port: 5196, strictPort: false }, define: { "import.meta.env.VITE_GOOGLE_CLIENT_ID": "undefined" } });
  await withoutId.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: process.env.NO_SANDBOX ? ["--no-sandbox"] : [],
  });
});
after(async () => {
  await browser?.close();
  await withId?.close();
  await withoutId?.close();
});

async function open({ googleStatus = 200, scriptFails = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  await context.route("https://accounts.google.com/gsi/client", (route) =>
    scriptFails ? route.abort() : route.fulfill({ status: 200, contentType: "text/javascript", body: GOOGLE_STUB }),
  );
  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    const cors = { "access-control-allow-origin": req.headers()["origin"] ?? "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(req.url()).pathname;
    requests.push({ method: req.method(), path, body: (() => { try { return req.postDataJSON(); } catch { return null; } })() });
    let res = json(404, { success: false, message: "Not found" });
    if (path === "/api/auth/google") {
      res = googleStatus === 200
        ? json(200, { success: true, message: "Signed in", data: { user: USER, token: "tok-google" } })
        : json(googleStatus, { success: false, message: "Google sign-in failed. Try again", code: "GOOGLE_INVALID" });
    } else if (path === "/api/auth/me") res = json(200, { success: true, message: "OK", data: USER });
    else if (path === "/api/dashboard") res = json(200, { success: true, message: "OK", data: { totals: { total: 0, inService: 0, underMaintenance: 0, outOfService: 0, retired: 0 }, overdue: [], dueSoon: [], recentLogs: [] } });
    return route.fulfill({ ...res, headers: { ...cors, "content-type": "application/json" } });
  });
  return { page, requests, close: () => context.close() };
}

describe("continue with Google", () => {
  it("signs in with the credential Google returns", async () => {
    const { page, requests, close } = await open();
    await page.goto(urlOf(withId) + "/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    assert.ok(await page.getByText("Grace Google").isVisible());
    assert.equal(await page.evaluate(() => localStorage.getItem("tack.accessToken")), "tok-google");
    assert.deepEqual(requests.find((r) => r.path === "/api/auth/google").body, { credential: "fake-google-credential-0123456789" });
    assert.equal(await page.evaluate(() => window.__clientId), "test-client.apps.googleusercontent.com");
    await close();
  });

  it("also appears on the create-account page, and draws the button once", async () => {
    const { page, close } = await open();
    await page.goto(urlOf(withId) + "/register");
    await page.getByRole("button", { name: "Continue with Google" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Continue with Google" }).count(), 1);
    await close();
  });

  it("shows the server's message when Google sign-in is refused", async () => {
    const { page, close } = await open({ googleStatus: 401 });
    await page.goto(urlOf(withId) + "/login");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.getByRole("alert").filter({ hasText: "Google sign-in failed" }).waitFor();
    assert.match(page.url(), /\/login$/);
    await close();
  });

  it("explains it when Google's script cannot load, and the form still works", async () => {
    const { page, close } = await open({ scriptFails: true });
    await page.goto(urlOf(withId) + "/login");
    await page.getByRole("alert").filter({ hasText: "Google sign-in could not load" }).waitFor();
    assert.ok(await page.getByLabel("Email").isVisible());
    await close();
  });

  it("shows no Google button when no client id is configured", async () => {
    const { page, close } = await open();
    await page.goto(urlOf(withoutId) + "/login");
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Continue with Google" }).count(), 0);
    await close();
  });
});
