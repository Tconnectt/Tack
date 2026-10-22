ALTER TABLE "equipment" ADD COLUMN "service_interval_days" integer CHECK ("service_interval_days" IS NULL OR "service_interval_days" > 0);

CREATE TYPE "maintenance_type" AS ENUM ('preventive', 'corrective', 'inspection', 'calibration');

CREATE TABLE "maintenance_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "equipment_id" uuid NOT NULL REFERENCES "equipment" ("id") ON DELETE CASCADE,
  "performed_on" date NOT NULL,
  "type" "maintenance_type" NOT NULL,
  "description" text NOT NULL,
  "parts_used" text,
  "performed_by" uuid NOT NULL REFERENCES "users" ("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "maintenance_logs_equipment_idx" ON "maintenance_logs" ("equipment_id", "performed_on" DESC);
