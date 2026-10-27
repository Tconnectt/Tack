-- Who changed what on each piece of equipment, and when. Append-only.
CREATE TABLE "equipment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "equipment_id" uuid NOT NULL REFERENCES "equipment" ("id") ON DELETE RESTRICT,
  "actor_id" uuid REFERENCES "users" ("id"),
  "kind" text NOT NULL CHECK ("kind" IN ('created', 'updated', 'status_changed')),
  "changes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "log_id" uuid REFERENCES "maintenance_logs" ("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "equipment_events_equipment_idx" ON "equipment_events" ("equipment_id", "created_at" DESC);

-- Equipment that existed before history tracking gets a starting entry with no actor.
INSERT INTO "equipment_events" ("equipment_id", "kind", "created_at")
SELECT "id", 'created', "created_at" FROM "equipment";
