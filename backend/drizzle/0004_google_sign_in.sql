-- Accounts created with Google have no password. google_sub is Google's stable id for the person.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_sub" text;
CREATE UNIQUE INDEX "users_google_sub_unique" ON "users" ("google_sub");
