import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import * as schema from "@/lib/db/schema"
import type { DB } from "@/lib/db"

/** Fresh in-memory Postgres with all migrations applied. */
export async function createTestDb(): Promise<{ db: DB; pg: PGlite }> {
  const pg = new PGlite()
  const db = drizzle({ client: pg, schema })
  await migrate(db, { migrationsFolder: "drizzle" })
  return { db: db as unknown as DB, pg }
}
