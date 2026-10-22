CREATE TYPE "user_role" AS ENUM ('manager', 'technician');
CREATE TYPE "equipment_status" AS ENUM ('in_service', 'under_maintenance', 'out_of_service', 'retired');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'technician',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");

CREATE TABLE "equipment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "model" text,
  "serial_number" text NOT NULL,
  "department" text NOT NULL,
  "status" "equipment_status" NOT NULL DEFAULT 'in_service',
  "installed_on" date,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "equipment_serial_number_unique" ON "equipment" ("serial_number");
CREATE INDEX "equipment_department_idx" ON "equipment" ("department");
CREATE INDEX "equipment_status_idx" ON "equipment" ("status");
