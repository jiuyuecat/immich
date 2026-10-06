import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "album" ADD "parentAlbumId" uuid;`.execute(db);
  await sql`CREATE INDEX "album_parentAlbumId_idx" ON "album" ("parentAlbumId");`.execute(db);
  await sql`ALTER TABLE "album" ADD CONSTRAINT "album_parentAlbumId_fkey" FOREIGN KEY ("parentAlbumId") REFERENCES "album" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;`.execute(db);
  await sql`ALTER TABLE "album" ADD CONSTRAINT "album_parentAlbumId_chk" CHECK ("parentAlbumId" != "id");`.execute(db);
  await sql`ALTER TABLE "album_user" ADD "includeSubAlbums" boolean NOT NULL DEFAULT false;`.execute(db);
  await sql`ALTER TABLE "shared_link" ADD "includeSubAlbums" boolean NOT NULL DEFAULT false;`.execute(db);
  await sql`CREATE TABLE "album_closure" (
  "id_ancestor" uuid NOT NULL,
  "id_descendant" uuid NOT NULL,
  CONSTRAINT "album_closure_id_ancestor_fkey" FOREIGN KEY ("id_ancestor") REFERENCES "album" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "album_closure_id_descendant_fkey" FOREIGN KEY ("id_descendant") REFERENCES "album" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "album_closure_pkey" PRIMARY KEY ("id_ancestor", "id_descendant")
);`.execute(db);
  await sql`CREATE INDEX "album_closure_id_ancestor_idx" ON "album_closure" ("id_ancestor");`.execute(db);
  await sql`CREATE INDEX "album_closure_id_descendant_idx" ON "album_closure" ("id_descendant");`.execute(db);
  // every album is its own ancestor (self row); existing albums are all top-level
  await sql`INSERT INTO "album_closure" ("id_ancestor", "id_descendant") SELECT "id", "id" FROM "album";`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "album" DROP COLUMN "parentAlbumId";`.execute(db);
  await sql`DROP INDEX "album_parentAlbumId_idx";`.execute(db);
  await sql`ALTER TABLE "album" DROP CONSTRAINT "album_parentAlbumId_fkey";`.execute(db);
  await sql`ALTER TABLE "album" DROP CONSTRAINT "album_parentAlbumId_chk";`.execute(db);
  await sql`ALTER TABLE "shared_link" DROP COLUMN "includeSubAlbums";`.execute(db);
  await sql`ALTER TABLE "album_user" DROP COLUMN "includeSubAlbums";`.execute(db);
  await sql`DROP TABLE "album_closure";`.execute(db);
}
