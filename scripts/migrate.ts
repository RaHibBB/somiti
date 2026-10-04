// Apply Drizzle migrations to DATABASE_URL.  Usage: pnpm db:migrate
// Works with Neon (postgres://…) and local PGlite (pglite:./.pglite).
import "dotenv/config"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite")
    const { drizzle } = await import("drizzle-orm/pglite")
    const { migrate } = await import("drizzle-orm/pglite/migrator")
    const client = new PGlite(url.slice("pglite:".length))
    await migrate(drizzle({ client }), { migrationsFolder: "drizzle" })
    await client.close()
  } else {
    const { Pool } = await import("@neondatabase/serverless")
    const { drizzle } = await import("drizzle-orm/neon-serverless")
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator")
    const pool = new Pool({ connectionString: url })
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" })
    await pool.end()
  }
  console.log("Migrations applied.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
