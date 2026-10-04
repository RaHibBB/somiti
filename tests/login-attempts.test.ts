import { beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { clearLoginAttempts, finishLock, reserveLoginAttempt } from "@/lib/auth/attempts"
import { createTestDb } from "./helpers/test-db"

let db: DB
let id: number

beforeAll(async () => {
  ;({ db } = await createTestDb())
  const [m] = await db.insert(members).values({ memberNo: 1, nameBn: "ক", joinedOn: "2026-10-01" }).returning()
  id = m.id
})

describe("login attempt throttling", () => {
  it("allows at most 5 attempts per window even when 20 arrive at once", async () => {
    const now = new Date("2026-10-04T10:00:00Z")
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveLoginAttempt(db, id, now)))
    const allowed = results.filter((r) => r.allowed)
    expect(allowed).toHaveLength(5)
    expect(allowed.filter((r) => r.allowed && r.lockedNow)).toHaveLength(1) // the 5th set the lock
    const [m] = await db.select().from(members).where(eq(members.id, id))
    expect(m.lockedUntil?.toISOString()).toBe("2026-10-04T10:15:00.000Z")
  })

  it("stays locked until the window ends, then starts over", async () => {
    await finishLock(db, id)
    expect((await reserveLoginAttempt(db, id, new Date("2026-10-04T10:14:00Z"))).allowed).toBe(false)
    const after = await reserveLoginAttempt(db, id, new Date("2026-10-04T10:16:00Z"))
    expect(after).toEqual({ allowed: true, attempt: 1, lockedNow: false })
  })

  it("a correct password clears the counter", async () => {
    await clearLoginAttempts(db, id)
    const [m] = await db.select().from(members).where(eq(members.id, id))
    expect(m).toMatchObject({ failedLogins: 0, lockedUntil: null })
  })
})
