import type { Config } from "../config.ts";
import type { Db } from "../db/types.ts";
import { listEquipment } from "./equipment.service.ts";
import { recentLogs } from "./maintenance.service.ts";

export async function getDashboard(db: Db, config: Config) {
  const all = await listEquipment(db, config, {});
  const count = (s: string) => all.filter((e) => e.status === s).length;
  const byDue = (a: { nextDueOn: string | null }, b: { nextDueOn: string | null }) =>
    (a.nextDueOn ?? "").localeCompare(b.nextDueOn ?? "");
  return {
    totals: {
      total: all.length,
      inService: count("in_service"),
      underMaintenance: count("under_maintenance"),
      outOfService: count("out_of_service"),
      retired: count("retired"),
    },
    overdue: all.filter((e) => e.dueStatus === "overdue").sort(byDue),
    dueSoon: all.filter((e) => e.dueStatus === "due_soon").sort(byDue),
    recentLogs: await recentLogs(db, 5),
  };
}
