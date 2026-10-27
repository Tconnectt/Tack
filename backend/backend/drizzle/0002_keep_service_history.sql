-- Deleting equipment must never wipe its service history. Retire it instead.
ALTER TABLE "maintenance_logs" DROP CONSTRAINT "maintenance_logs_equipment_id_fkey";
ALTER TABLE "maintenance_logs"
  ADD CONSTRAINT "maintenance_logs_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "equipment" ("id") ON DELETE RESTRICT;
