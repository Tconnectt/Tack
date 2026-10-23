// Browser tests. Every call to the API is answered by a mock below, so no backend is needed.
// First time only: npx playwright install chromium
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "http://api.test";
process.env.VITE_API_URL = API;
process.env.VITE_TIMEZONE = "Africa/Lagos";
const NOW = new Date("2026-10-22T11:00:00Z"); // 22 Oct 2026, midday in Lagos

const MANAGER = { id: "u-1", name: "Ada Manager", email: "ada@example.com", role: "manager" };
const TECH = { id: "u-2", name: "Tunde Tech", email: "tunde@example.com", role: "technician" };

const base = { notes: null, createdAt: "2026-01-02T10:00:00Z", updatedAt: "2026-01-02T10:00:00Z", lastServicedOn: null };
const ECG = { ...base, id: "11111111-1111-4111-8111-111111111111", name: "ECG Machine", model: "CardioPro 12", serialNumber: "ECG-001", department: "Cardiology", status: "in_service", installedOn: "2026-01-01", serviceIntervalDays: 90, notes: "Next to the nurses station", lastServicedOn: "2026-10-01", nextDueOn: "2026-12-30", daysUntilDue: 69, dueStatus: "ok" };
const PUMP = { ...base, id: "22222222-2222-4222-8222-222222222222", name: "Infusion Pump", model: "InfuSafe 3", serialNumber: "INF-100", department: "Ward A", status: "under_maintenance", installedOn: "2026-01-01", serviceIntervalDays: 90, nextDueOn: "2026-04-01", daysUntilDue: -204, dueStatus: "overdue" };
const SUCTION = { ...base, id: "33333333-3333-4333-8333-333333333333", name: "Suction Pump", model: null, serialNumber: "SUC-7", department: "Theatre", status: "in_service", installedOn: "2026-10-01", serviceIntervalDays: 30, nextDueOn: "2026-10-31", daysUntilDue: 9, dueStatus: "due_soon" };
const LAMP = { ...base, id: "44444444-4444-4444-8444-444444444444", name: "Exam Lamp", model: null, serialNumber: "LMP-2", department: "Ward A", status: "out_of_service", installedOn: null, serviceIntervalDays: null, nextDueOn: null, daysUntilDue: null, dueStatus: "no_schedule" };

function makeState() {
  return {
    equipment: [ECG, PUMP, SUCTION, LAMP].map((e) => ({ ...e })),
    logs: {
      [ECG.id]: [
        { id: "l-1", equipmentId: ECG.id, performedOn: "2026-10-01", type: "preventive", description: "Cleaned leads and tested output", partsUsed: "Electrode gel", performedByName: "Tunde Tech", createdAt: "2026-10-01T09:00:00Z" },
      ],
    },
    requests: [],
    expireSession: false,
    rejectNextLog: false,
  };
}

const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ok = (data, status = 200) => json(status, { success: true, message: "OK", data });
const fail = (status, message, code, issues) => json(status, { success: false, message, code, issues });

function handle(state, req, path, search, body, user) {
  const authed = path !== "/api/auth/login" && path !== "/api/auth/register";
  if (authed && (state.expireSession || !user)) return fail(401, "Your session has expired. Sign in again", "UNAUTHORIZED");

  if (path === "/api/auth/login") {
    if (body.password !== "password123") return fail(401, "Email or password is incorrect", "INVALID_CREDENTIALS");
    return ok({ user: body.email.startsWith("tunde") ? TECH : MANAGER, token: body.email.startsWith("tunde") ? "tok-tech" : "tok-manager" });
  }
  if (path === "/api/auth/register") {
    if (body.email === "taken@example.com") return fail(409, "An account with this email already exists", "EMAIL_EXISTS");
    return ok({ user: { id: "u-9", name: body.name, email: body.email, role: "manager" }, token: "tok-new" }, 201);
  }
  if (path === "/api/auth/me") return ok(user);

  if (path === "/api/dashboard") {
    const eq = state.equipment;
    const recent = Object.values(state.logs).flat().map((l) => ({ ...l, equipmentName: eq.find((e) => e.id === l.equipmentId).name }));
    return ok({
      totals: {
        total: eq.length,
        inService: eq.filter((e) => e.status === "in_service").length,
        underMaintenance: eq.filter((e) => e.status === "under_maintenance").length,
        outOfService: eq.filter((e) => e.status === "out_of_service").length,
        retired: eq.filter((e) => e.status === "retired").length,
      },
      overdue: eq.filter((e) => e.dueStatus === "overdue"),
      dueSoon: eq.filter((e) => e.dueStatus === "due_soon"),
      recentLogs: recent,
    });
  }

  if (path === "/api/equipment" && req.method() === "GET") {
    const q = search.get("q")?.toLowerCase();
    const status = search.get("status");
    const department = search.get("department")?.toLowerCase();
    return ok(
      state.equipment.filter(
        (e) =>
          (!q || [e.name, e.model ?? "", e.serialNumber].some((v) => v.toLowerCase().includes(q))) &&
          (!status || e.status === status) &&
          (!department || e.department.toLowerCase() === department),
      ),
    );
  }
  if (path === "/api/equipment" && req.method() === "POST") {
    if (user.role !== "manager") return fail(403, "You do not have permission to do this", "FORBIDDEN");
    if (state.equipment.some((e) => e.serialNumber === body.serialNumber)) return fail(409, "Equipment with this serial number already exists", "SERIAL_EXISTS");
    const item = { ...base, model: null, installedOn: null, serviceIntervalDays: null, status: "in_service", nextDueOn: null, daysUntilDue: null, dueStatus: "no_schedule", ...body, id: "55555555-5555-4555-8555-555555555555" };
    state.equipment.push(item);
    return ok(item, 201);
  }

  const m = path.match(/^\/api\/equipment\/([^/]+)(\/maintenance)?$/);
  if (m) {
    const item = state.equipment.find((e) => e.id === m[1]);
    if (!item) return fail(404, "Equipment not found", "NOT_FOUND");
    if (m[2] && req.method() === "GET") return ok([...(state.logs[item.id] ?? [])].sort((a, b) => b.performedOn.localeCompare(a.performedOn)));
    if (m[2] && req.method() === "POST") {
      if (state.rejectNextLog) {
        state.rejectNextLog = false;
        return fail(400, "The service date cannot be in the future", "DATE_IN_FUTURE");
      }
      const log = { id: `l-${Date.now()}`, equipmentId: item.id, performedOn: body.performedOn, type: body.type, description: body.description, partsUsed: body.partsUsed ?? null, performedByName: user.name, createdAt: new Date().toISOString() };
      (state.logs[item.id] ??= []).push(log);
      if (body.setStatus) item.status = body.setStatus;
      if (body.type === "preventive" || body.type === "calibration") item.lastServicedOn = body.performedOn;
      return ok(log, 201);
    }
    if (req.method() === "GET") return ok(item);
    if (req.method() === "PATCH") {
      if (user.role !== "manager") return fail(403, "You do not have permission to do this", "FORBIDDEN");
      Object.assign(item, body);
      if (!item.serviceIntervalDays) Object.assign(item, { nextDueOn: null, daysUntilDue: null, dueStatus: "no_schedule" });
      return ok(item);
    }
  }
  return fail(404, "Not found");
}

let server;
let browser;
let appUrl;

before(async () => {
  server = await createServer({ root, logLevel: "error", server: { port: 5199, strictPort: false } });
  await server.listen();
  appUrl = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: process.env.NO_SANDBOX ? ["--no-sandbox"] : [],
  });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** Opens a fresh browser tab with the mock API. `role` signs the person in already. */
async function open({ role, width = 1100, height = 800 } = {}) {
  const state = makeState();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const users = { "tok-manager": MANAGER, "tok-tech": TECH, "tok-new": { id: "u-9", name: "New Person", email: "new@example.com", role: "manager" } };

  await context.route(`${API}/**`, async (route) => {
    const req = route.request();
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    let body = null;
    try {
      body = req.postDataJSON();
    } catch {}
    const token = (req.headers()["authorization"] ?? "").replace("Bearer ", "");
    state.requests.push({ method: req.method(), path: url.pathname, search: url.search, body });
    const res = handle(state, req, url.pathname, url.searchParams, body ?? {}, users[token] ?? null);
    return route.fulfill({ ...res, headers: { ...cors, "content-type": "application/json" } });
  });

  if (role) {
    // Seed the saved login once per tab, so signing out and reloading really is signed out.
    await page.addInitScript((token) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("tack.accessToken", token);
      }
    }, role === "manager" ? "tok-manager" : "tok-tech");
  }
  return { page, state, close: () => context.close() };
}

const sent = (state, method, path) => state.requests.filter((r) => r.method === method && r.path === path);
async function until(fn, message = "condition", ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.fail(`Timed out waiting for ${message}`);
}
const cards = (page) => page.locator("main ul > li");
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

describe("signing in", () => {
  it("sends signed-out visitors to the sign-in page", async () => {
    const { page, close } = await open();
    await page.goto(appUrl + "/equipment");
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    assert.match(page.url(), /\/login$/);
    await close();
  });

  it("signs in, shows the dashboard and the person's name and role", async () => {
    const { page, state, close } = await open();
    await page.goto(appUrl + "/login");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    assert.ok(await page.getByText("Ada Manager").isVisible());
    assert.ok(await page.getByText("manager", { exact: true }).isVisible());
    assert.equal(await page.evaluate(() => localStorage.getItem("tack.accessToken")), "tok-manager");
    assert.equal(sent(state, "POST", "/api/auth/login").length, 1);
    await close();
  });

  it("returns to the page they were trying to open after signing in", async () => {
    const { page, close } = await open();
    await page.goto(appUrl + "/equipment?status=in_service");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Equipment", exact: true }).waitFor();
    assert.match(page.url(), /\/equipment\?status=in_service$/);
    await close();
  });

  it("shows an error for a wrong password and stays on the form", async () => {
    const { page, close } = await open();
    await page.goto(appUrl + "/login");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").filter({ hasText: "Email or password is incorrect" }).waitFor();
    assert.match(page.url(), /\/login$/);
    await close();
  });

  it("checks sign-up input before sending anything, then creates the account", async () => {
    const { page, state, close } = await open();
    await page.goto(appUrl + "/register");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByText("Enter your name").waitFor();
    await page.getByText("Enter a valid email address").waitFor();
    await page.getByText("Use at least 8 characters").first().waitFor();
    assert.equal(sent(state, "POST", "/api/auth/register").length, 0);
    await page.getByLabel("Name").fill("New Person");
    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    assert.deepEqual(sent(state, "POST", "/api/auth/register")[0].body, { name: "New Person", email: "new@example.com", password: "password123" });
    await close();
  });

  it("shows the server's message when the email is already taken", async () => {
    const { page, close } = await open();
    await page.goto(appUrl + "/register");
    await page.getByLabel("Name").fill("Someone");
    await page.getByLabel("Email").fill("taken@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("alert").filter({ hasText: "already exists" }).waitFor();
    await close();
  });

  it("signs out, and stays signed out after a reload", async () => {
    const { page, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/");
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("tack.accessToken")), null);
    await page.reload();
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    await close();
  });

  it("sends the person back to sign in, with a notice, when the session ends mid-use", async () => {
    const { page, state, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/");
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    state.expireSession = true;
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Equipment" }).click();
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    await page.getByText("Your session has ended").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("tack.accessToken")), null);
    await close();
  });
});

describe("dashboard", () => {
  it("shows totals, overdue and due-soon equipment, and recent work", async () => {
    const { page, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/");
    await page.getByRole("heading", { name: "Overdue (1)" }).waitFor();
    await page.getByRole("heading", { name: "Due soon (1)" }).waitFor();
    assert.ok(await page.getByText("Overdue by 204 days").isVisible());
    assert.ok(await page.getByText("Due in 9 days").isVisible());
    assert.ok(await page.getByText("Total equipment").isVisible());
    const recent = page.getByRole("heading", { name: "Recent work" }).locator("..");
    assert.ok(await recent.getByText("Cleaned leads and tested output").isVisible());
    await page.getByRole("link", { name: "Infusion Pump" }).first().click();
    await page.getByRole("heading", { name: "Infusion Pump" }).waitFor();
    await close();
  });
});

describe("equipment list", () => {
  it("lists equipment with status and due badges", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment");
    await cards(page).first().waitFor();
    assert.equal(await cards(page).count(), 4);
    assert.ok(await cards(page).filter({ hasText: "Infusion Pump" }).getByText("Under maintenance").isVisible());
    assert.ok(await cards(page).filter({ hasText: "Infusion Pump" }).getByText("Overdue by 204 days").isVisible());
    assert.ok(await cards(page).filter({ hasText: "Exam Lamp" }).getByText("No service schedule").isVisible());
    await close();
  });

  it("searches after a short pause and filters by status", async () => {
    const { page, state, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment");
    await cards(page).first().waitFor();
    await page.getByLabel("Search").fill("infusafe");
    await until(() => state.requests.some((r) => r.path === "/api/equipment" && r.search.includes("q=infusafe")), "search request");
    await until(async () => (await cards(page).count()) === 1, "one result");
    assert.ok(await cards(page).first().getByText("Infusion Pump").isVisible());
    await page.getByLabel("Search").fill("");
    await page.getByLabel("Status").selectOption("out_of_service");
    await until(async () => (await cards(page).count()) === 1, "status filter");
    assert.ok(await cards(page).first().getByText("Exam Lamp").isVisible());
    assert.ok(state.requests.some((r) => r.search.includes("status=out_of_service")));
    await close();
  });

  it("says so when nothing matches", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment");
    await page.getByLabel("Search").fill("zzzz");
    await page.getByText("No equipment matches these filters.").waitFor();
    await close();
  });

  it("keeps the filters in the address so a refresh keeps them", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment?status=under_maintenance");
    await until(async () => (await cards(page).count()) === 1, "filtered from address");
    assert.equal(await page.getByLabel("Status").inputValue(), "under_maintenance");
    await close();
  });
});

describe("who can change equipment", () => {
  it("hides add and edit from technicians and explains if they open the page anyway", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment");
    await cards(page).first().waitFor();
    assert.equal(await page.getByRole("link", { name: "Add equipment" }).count(), 0);
    await page.goto(appUrl + "/equipment/new");
    await page.getByText("Only managers can add or edit equipment.").waitFor();
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByRole("heading", { name: "ECG Machine" }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Edit", exact: true }).count(), 0);
    await close();
  });

  it("shows add and edit to managers", async () => {
    const { page, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/equipment");
    await page.getByRole("link", { name: "Add equipment" }).waitFor();
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
    await close();
  });
});

describe("adding and editing equipment", () => {
  it("checks required fields, then sends only what was filled in", async () => {
    const { page, state, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/equipment/new");
    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByText("Enter the equipment name").waitFor();
    await page.getByText("Enter the serial number").waitFor();
    await page.getByText("Enter the department").waitFor();
    assert.equal(sent(state, "POST", "/api/equipment").length, 0);

    await page.getByLabel("Name").fill("Defibrillator");
    await page.getByLabel("Serial number").fill("DEF-9");
    await page.getByLabel("Department").fill("Emergency");
    await page.getByLabel("Service every").fill("abc");
    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByText("Use a whole number of days from 1 to 3650").waitFor();
    assert.equal(sent(state, "POST", "/api/equipment").length, 0);

    await page.getByLabel("Service every").fill("60");
    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByRole("heading", { name: "Defibrillator" }).waitFor();
    const posts = sent(state, "POST", "/api/equipment");
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body, { name: "Defibrillator", serialNumber: "DEF-9", department: "Emergency", status: "in_service", serviceIntervalDays: 60 });
    await close();
  });

  it("tells the person when the serial number is already used and stays on the form", async () => {
    const { page, close } = await open({ role: "manager" });
    await page.goto(appUrl + "/equipment/new");
    await page.getByLabel("Name").fill("Another ECG");
    await page.getByLabel("Serial number").fill("ECG-001");
    await page.getByLabel("Department").fill("Cardiology");
    await page.getByRole("button", { name: "Add equipment" }).click();
    await page.getByText("Another item already uses this serial number").waitFor();
    assert.match(page.url(), /\/equipment\/new$/);
    await close();
  });

  it("prefills the edit form and clears optional fields with null", async () => {
    const { page, state, close } = await open({ role: "manager" });
    await page.goto(appUrl + `/equipment/${ECG.id}/edit`);
    await until(async () => (await page.getByLabel("Name").count()) > 0, "form");
    assert.equal(await page.getByLabel("Name").inputValue(), "ECG Machine");
    assert.equal(await page.getByLabel("Service every").inputValue(), "90");
    assert.equal(await page.getByLabel("Notes").inputValue(), "Next to the nurses station");
    await page.getByLabel("Service every").fill("");
    await page.getByLabel("Notes").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("heading", { name: "ECG Machine" }).waitFor();
    await page.getByText("Not scheduled").first().waitFor();
    const patch = sent(state, "PATCH", `/api/equipment/${ECG.id}`)[0].body;
    assert.equal(patch.serviceIntervalDays, null);
    assert.equal(patch.notes, null);
    assert.equal(patch.model, "CardioPro 12");
    await close();
  });
});

describe("equipment details and recording service", () => {
  it("shows the schedule and the service history", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByRole("heading", { name: "ECG Machine" }).waitFor();
    assert.ok(await page.getByText("90 days").isVisible());
    assert.ok(await page.getByText("1 Oct 2026").first().isVisible());
    assert.ok(await page.getByText("30 Dec 2026").isVisible());
    assert.ok(await page.getByText("Next to the nurses station").isVisible());
    assert.ok(await page.getByText("Cleaned leads and tested output").isVisible());
    assert.ok(await page.getByText("Parts: Electrode gel").isVisible());
    await close();
  });

  it("defaults the date to today, blocks a future date, and sends nothing for it", async () => {
    const { page, state, close } = await open({ role: "technician" });
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByLabel("Date of work").waitFor();
    assert.equal(await page.getByLabel("Date of work").inputValue(), "2026-10-22");
    await page.getByLabel("Date of work").fill("2026-10-23");
    await page.getByLabel("What was done").fill("Planned check");
    await page.getByRole("button", { name: "Record service" }).click();
    await page.getByText("The date cannot be in the future").waitFor();
    assert.equal(sent(state, "POST", `/api/equipment/${ECG.id}/maintenance`).length, 0);
    await close();
  });

  it("records service, updates the history and changes the status", async () => {
    const { page, state, close } = await open({ role: "technician" });
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByLabel("What was done").fill("Replaced lead wire");
    await page.getByLabel("Type of work").selectOption("corrective");
    await page.getByLabel("Parts used").fill("Lead wire set");
    await page.getByLabel("Change status to").selectOption("out_of_service");
    await page.getByRole("button", { name: "Record service" }).click();
    await page.getByText("Service recorded.").waitFor();
    await page.getByText("Replaced lead wire").waitFor();
    assert.ok(await page.getByText("Parts: Lead wire set").isVisible());
    const posts = sent(state, "POST", `/api/equipment/${ECG.id}/maintenance`);
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].body, { performedOn: "2026-10-22", type: "corrective", description: "Replaced lead wire", partsUsed: "Lead wire set", setStatus: "out_of_service" });
    await until(async () => (await page.getByText("Out of service").count()) > 0, "new status shown");
    assert.equal(await page.getByLabel("What was done").inputValue(), "", "form is cleared after saving");
    await close();
  });

  it("shows the server's message if it refuses the date", async () => {
    const { page, state, close } = await open({ role: "technician" });
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByLabel("Date of work").waitFor();
    state.rejectNextLog = true;
    await page.getByLabel("What was done").fill("Routine check");
    await page.getByRole("button", { name: "Record service" }).click();
    await page.getByText("The date cannot be in the future").waitFor();
    assert.equal(await page.getByText("Service recorded.").count(), 0);
    await close();
  });

  it("shows a clear error with a retry for equipment that does not exist", async () => {
    const { page, close } = await open({ role: "technician" });
    await page.goto(appUrl + "/equipment/99999999-9999-4999-8999-999999999999");
    await page.getByRole("alert").filter({ hasText: "Equipment not found" }).waitFor();
    await page.getByRole("button", { name: "Try again" }).waitFor();
    await close();
  });
});

describe("on a phone", () => {
  it("fits the screen without sideways scrolling on every main page", async () => {
    const { page, close } = await open({ role: "manager", width: 390, height: 844 });
    await page.goto(appUrl + "/");
    await page.getByRole("heading", { name: "Overdue (1)" }).waitFor();
    assert.ok(await noSideScroll(page), "dashboard");
    await page.goto(appUrl + "/equipment");
    await cards(page).first().waitFor();
    assert.ok(await noSideScroll(page), "list");
    await page.goto(appUrl + `/equipment/${ECG.id}`);
    await page.getByRole("heading", { name: "ECG Machine" }).waitFor();
    assert.ok(await noSideScroll(page), "details");
    await page.goto(appUrl + "/equipment/new");
    await page.getByLabel("Serial number").waitFor();
    assert.ok(await noSideScroll(page), "add form");
    await close();
  });
});
