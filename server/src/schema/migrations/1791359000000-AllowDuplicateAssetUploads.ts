import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Assets created while "allow duplicate uploads" is enabled are excluded from the
  // per-owner checksum uniqueness index, so the same file may be stored more than once.
  await sql`ALTER TABLE "asset" ADD "duplicateAllowed" boolean NOT NULL DEFAULT false;`.execute(db);
  await sql`DROP INDEX "UQ_assets_owner_checksum";`.execute(db);
  await sql`CREATE UNIQUE INDEX "UQ_assets_owner_checksum" ON "asset" ("ownerId", "checksum") WHERE ("libraryId" IS NULL AND "duplicateAllowed" = false);`.execute(db);
  await sql`UPDATE "migration_overrides" SET "value" = '{"type":"index","name":"UQ_assets_owner_checksum","sql":"CREATE UNIQUE INDEX \\"UQ_assets_owner_checksum\\" ON \\"asset\\" (\\"ownerId\\", \\"checksum\\") WHERE (\\"libraryId\\" IS NULL AND \\"duplicateAllowed\\" = false);"}'::jsonb WHERE "name" = 'index_UQ_assets_owner_checksum';`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX "UQ_assets_owner_checksum";`.execute(db);
  await sql`CREATE UNIQUE INDEX "UQ_assets_owner_checksum" ON "asset" ("ownerId", "checksum") WHERE ("libraryId" IS NULL);`.execute(db);
  await sql`UPDATE "migration_overrides" SET "value" = '{"type":"index","name":"UQ_assets_owner_checksum","sql":"CREATE UNIQUE INDEX \\"UQ_assets_owner_checksum\\" ON \\"asset\\" (\\"ownerId\\", \\"checksum\\") WHERE (\\"libraryId\\" IS NULL);"}'::jsonb WHERE "name" = 'index_UQ_assets_owner_checksum';`.execute(db);
  await sql`ALTER TABLE "asset" DROP COLUMN "duplicateAllowed";`.execute(db);
}
