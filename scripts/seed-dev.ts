// Local demo data for the embedded PGlite dev database ONLY.
// Usage: DATABASE_URL=pglite:./.pglite pnpm tsx scripts/seed-dev.ts  (after pnpm db:migrate)
// Every demo account uses the dev password below; first login forces a password change for members (not admins).
// Demo logins: admin@samiti.test (admin), member3@samiti.test (member), or any phone / member number.
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PGlite } from "@electric-sql/pglite"

export const DEV_PIN = "246810"

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.startsWith("pglite:")) throw new Error("seed-dev only runs against a local pglite: database")
  const db = new PGlite(url.slice("pglite:".length))
  const existing = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM members")
  if (existing.rows[0].n > 0) {
    // Older dev databases: add the demo emails if missing.
    await db.query("UPDATE members SET email = 'admin@samiti.test' WHERE member_no = 1 AND email IS NULL")
    await db.query("UPDATE members SET email = 'member3@samiti.test' WHERE member_no = 3 AND email IS NULL")
    await db.close()
    console.log("Already seeded (demo emails ensured).")
    return
  }
  const hash = await bcrypt.hash(DEV_PIN, 10)
  const people: [number, string, string | null, "admin" | "member", number, string][] = [
    [1, "মোঃ রফিকুল ইসলাম", "01859336893", "admin", 2, "2026-10-01"],
    [2, "আব্দুল করিম", "01310760069", "admin", 1, "2026-10-01"],
    [3, "নাসরিন আক্তার", "01711111111", "member", 3, "2026-10-01"],
    [4, "শহিদুল্লাহ খান", "01722222222", "member", 5, "2026-10-01"],
    [5, "তানভীর হোসেন", null, "member", 1, "2027-01-15"],
    [6, "সুমাইয়া ক্ষমা", "01733333333", "member", 2, "2026-10-01"],
  ]
  for (const [no, name, phone, role, shares, joined] of people) {
    const r = await db.query<{ id: number }>(
      `INSERT INTO members (member_no, name_bn, phone, role, joined_on, pin_hash, must_change_pin)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [no, name, phone, role, joined, hash, role !== "admin"],
    )
    await db.query("INSERT INTO share_history (member_id, shares, effective_month, set_by) VALUES ($1, $2, '2026-10-01', 1)", [
      r.rows[0].id,
      shares,
    ])
  }
  // Member 3 raises shares from 3 to 4 starting Jan 2027.
  await db.query("INSERT INTO share_history (member_id, shares, effective_month, set_by) VALUES (3, 4, '2027-01-01', 1)")
  const pay = (m: number, month: string, amt: number, on: string, method = "cash") =>
    db.query("INSERT INTO payments (member_id, for_month, amount, paid_on, method, received_by) VALUES ($1,$2,$3,$4,$5,1)", [
      m,
      month,
      amt,
      on,
      method,
    ])
  await pay(1, "2026-10-01", 1000, "2026-10-03")
  await pay(2, "2026-10-01", 500, "2026-10-04", "bkash")
  await pay(3, "2026-10-01", 1000, "2026-10-05")
  await pay(3, "2026-10-01", 500, "2026-10-12")
  await pay(4, "2026-10-01", 2500, "2026-10-02")
  await pay(4, "2026-11-01", 2500, "2026-11-03")
  await db.query(
    "INSERT INTO transactions (date, type, description, amount, approved_by, created_by) VALUES ('2026-10-06','expense','রেজিস্টার খাতা ও রসিদ বই',350,'সভার সিদ্ধান্ত',1)",
  )
  await db.query(
    "INSERT INTO notices (title, body, created_by) VALUES ('স্বাগতম','সমিতির নতুন ওয়েবসাইটে স্বাগতম। প্রতি মাসের ১০ তারিখের মধ্যে চাঁদা জমা দিন।',1)",
  )
  await db.query("UPDATE members SET email = 'admin@samiti.test' WHERE member_no = 1")
  await db.query("UPDATE members SET email = 'member3@samiti.test' WHERE member_no = 3")
  await db.close()
  console.log(`Seeded demo data. Dev password for every account: ${DEV_PIN}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
