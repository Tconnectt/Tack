import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

// Public demo logins. Everything here is made up.
export const DEMO_PASSWORD = "TackDemo2026!";
const MANAGER = { name: "Demo Manager", email: "manager@tack-demo.dev" };
const TECHNICIAN = { name: "Demo Technician", email: "technician@tack-demo.dev" };

/** Date as YYYY-MM-DD, `daysAgo` days before today. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type Log = { ago: number; type: "preventive" | "corrective" | "inspection" | "calibration"; what: string; parts?: string; by: "m" | "t" };
type Item = {
  name: string;
  model: string;
  serial: string;
  department: string;
  status?: "in_service" | "under_maintenance" | "out_of_service" | "retired";
  installedAgo: number;
  interval: number | null;
  notes?: string;
  logs: Log[];
};

// Dates are relative to today, so the dashboard always shows a mix of
// on schedule, due soon and overdue equipment.
const ITEMS: Item[] = [
  {
    name: "Patient Monitor",
    model: "IntelliVue MX450",
    serial: "DEMO-PM-0142",
    department: "ICU",
    installedAgo: 400,
    interval: 180,
    logs: [
      { ago: 120, type: "inspection", what: "Checked alarms, cables and battery backup.", by: "t" },
      { ago: 20, type: "preventive", what: "Full preventive service. Cleaned, tested ECG, SpO2 and NIBP modules.", parts: "Battery pack", by: "t" },
    ],
  },
  {
    name: "Ultrasound Scanner",
    model: "Vivid T8",
    serial: "DEMO-US-0377",
    department: "Radiology",
    installedAgo: 520,
    interval: 90,
    notes: "Probe cable is stiff on the right side. Watch for wear.",
    logs: [
      { ago: 100, type: "preventive", what: "Quarterly service. Cleaned filters, checked probes and image quality.", by: "t" },
      { ago: 45, type: "corrective", what: "Replaced worn trackball after the cursor stuck.", parts: "Trackball", by: "t" },
    ],
  },
  {
    name: "ECG Machine",
    model: "BeneHeart R3",
    serial: "DEMO-ECG-0518",
    department: "Cardiology",
    installedAgo: 300,
    interval: 90,
    logs: [{ ago: 78, type: "preventive", what: "Tested leads and printer, updated settings, checked battery.", by: "t" }],
  },
  {
    name: "Infusion Pump",
    model: "Spectrum IQ",
    serial: "DEMO-IP-0829",
    department: "Ward B",
    installedAgo: 250,
    interval: 120,
    logs: [{ ago: 30, type: "calibration", what: "Flow rate calibration against a reference. Within tolerance.", by: "m" }],
  },
  {
    name: "Anaesthesia Machine",
    model: "Fabius GS",
    serial: "DEMO-AM-0044",
    department: "Theatre 2",
    status: "under_maintenance",
    installedAgo: 900,
    interval: 90,
    notes: "Out of the theatre list until the flow sensor is replaced.",
    logs: [
      { ago: 85, type: "preventive", what: "Leak test and vaporizer check passed.", by: "t" },
      { ago: 3, type: "corrective", what: "Flow sensor reading drifts. Ordered replacement sensor.", by: "t" },
    ],
  },
  {
    name: "Suction Pump",
    model: "Dominant 50",
    serial: "DEMO-SP-1190",
    department: "Emergency",
    installedAgo: 700,
    interval: 365,
    logs: [{ ago: 200, type: "preventive", what: "Replaced filters and tubing, tested vacuum level.", parts: "Filter, tubing", by: "t" }],
  },
  {
    name: "Mobile X-ray Unit",
    model: "DRX-Evolution",
    serial: "DEMO-XR-0007",
    department: "Radiology",
    status: "out_of_service",
    installedAgo: 1200,
    interval: 180,
    notes: "Waiting for a new X-ray tube. Do not use.",
    logs: [
      { ago: 190, type: "preventive", what: "Checked collimator, cables and exposure output.", by: "t" },
      { ago: 5, type: "corrective", what: "No exposure on trigger. Tube failure confirmed, replacement requested.", by: "t" },
    ],
  },
  {
    name: "Vital Signs Monitor",
    model: "Spot 4400",
    serial: "DEMO-VS-2210",
    department: "Outpatient",
    installedAgo: 150,
    interval: null,
    notes: "No fixed service interval set yet.",
    logs: [],
  },
  {
    name: "Defibrillator",
    model: "TEC-5521",
    serial: "DEMO-DF-0301",
    department: "Emergency",
    status: "retired",
    installedAgo: 2400,
    interval: null,
    notes: "Retired after replacement. Kept for spare parts.",
    logs: [{ ago: 400, type: "inspection", what: "Final inspection before retirement.", by: "m" }],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing. Set it in backend/.env.local");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ total: string }>("SELECT count(*) AS total FROM users");
    if (Number(rows[0].total) > 0) {
      console.log("Database already has users. Seed skipped.");
      return;
    }
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await client.query("BEGIN");
    try {
      const ids: Record<"m" | "t", string> = { m: "", t: "" };
      const m = await client.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'manager') RETURNING id",
        [MANAGER.name, MANAGER.email, hash],
      );
      ids.m = m.rows[0].id;
      const t = await client.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'technician') RETURNING id",
        [TECHNICIAN.name, TECHNICIAN.email, hash],
      );
      ids.t = t.rows[0].id;

      for (const item of ITEMS) {
        const e = await client.query(
          `INSERT INTO equipment (name, model, serial_number, department, status, installed_on, service_interval_days, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            item.name,
            item.model,
            item.serial,
            item.department,
            item.status ?? "in_service",
            daysAgo(item.installedAgo),
            item.interval,
            item.notes ?? null,
          ],
        );
        await client.query(
          `INSERT INTO equipment_events (equipment_id, actor_id, kind, created_at)
           VALUES ($1, $2, 'created', now() - ($3 || ' days')::interval)`,
          // Added before its oldest service record, so the history reads in order.
          [e.rows[0].id, ids.m, String(Math.max(60, ...item.logs.map((l) => l.ago)) + 5)],
        );
        let lastLogId: string | null = null;
        let lastLogAgo = 0;
        for (const log of item.logs) {
          const l = await client.query(
            `INSERT INTO maintenance_logs (equipment_id, performed_on, type, description, parts_used, performed_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [e.rows[0].id, daysAgo(log.ago), log.type, log.what, log.parts ?? null, ids[log.by]],
          );
          lastLogId = l.rows[0].id;
          lastLogAgo = log.ago;
        }
        // Items that are not in service got there through a recorded status change.
        if (item.status && item.status !== "in_service" && item.logs.length > 0) {
          await client.query(
            `INSERT INTO equipment_events (equipment_id, actor_id, kind, changes, log_id, created_at)
             VALUES ($1, $2, 'status_changed', $3::jsonb, $4, now() - ($5 || ' days')::interval)`,
            [
              e.rows[0].id,
              ids.t,
              JSON.stringify([{ field: "status", from: "in_service", to: item.status }]),
              lastLogId,
              String(lastLogAgo),
            ],
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    console.log(`Seeded ${ITEMS.length} equipment items.`);
    console.log(`Manager:    ${MANAGER.email} / ${DEMO_PASSWORD}`);
    console.log(`Technician: ${TECHNICIAN.email} / ${DEMO_PASSWORD}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
