import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema"

// Production: Neon over WebSockets (Pool), not neon-http, because writes need
// interactive transactions (a payment + its audit row + its sheet_outbox row
// commit together). Node 22+ has a global WebSocket, so no `ws` package is needed.
//
// Local dev / tests: DATABASE_URL="pglite:./.pglite" uses embedded Postgres (PGlite).

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0]

const g = globalThis as unknown as { samitiDb?: DB }

function createDb(): DB {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  if (url.startsWith("pglite:")) {
    // Dev-only. Required lazily so PGlite is never bundled into the production path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite")
    const dir = url.slice("pglite:".length) || undefined
    return drizzlePglite({ client: new PGlite(dir), schema }) as unknown as DB
  }
  const pool = new Pool({ connectionString: url })
  return drizzle({ client: pool, schema }) as unknown as DB
}

export function getDb(): DB {
  if (!g.samitiDb) g.samitiDb = createDb()
  return g.samitiDb
}

/** Tests inject a PGlite-backed database here. */
export function setDb(db: DB) {
  g.samitiDb = db
}

export { schema }
