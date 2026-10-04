import { beforeAll, describe, expect, it } from "vitest"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { auditLog, members } from "@/lib/db/schema"
import { createInvites, listInviteCandidates } from "@/lib/services/invites"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
const ids: Record<string, number> = {}

beforeAll(async () => {
  ;({ db } = await createTestDb())
  const old = await bcrypt.hash("my-own-password", 4)
  const rows = await db
    .insert(members)
    .values([
      { memberNo: 1, nameBn: "অ্যাডমিন", joinedOn: "2026-10-01", role: "admin", pinHash: old, mustChangePin: false },
      { memberNo: 2, nameBn: "নতুন এক", phone: "01711111111", joinedOn: "2026-10-01", pinHash: await bcrypt.hash("111222", 4), mustChangePin: true },
      { memberNo: 3, nameBn: "নতুন দুই", joinedOn: "2026-10-01", pinHash: await bcrypt.hash("333444", 4), mustChangePin: true },
      { memberNo: 4, nameBn: "নিজে দিয়েছেন", joinedOn: "2026-10-01", pinHash: old, mustChangePin: false },
      { memberNo: 5, nameBn: "বাতিল", joinedOn: "2026-10-01", status: "cancelled", pinHash: old, mustChangePin: true },
    ])
    .returning()
  adminId = rows[0].id
  rows.forEach((r) => (ids[`m${r.memberNo}`] = r.id))
})

describe("first-login invites", () => {
  it("lists only active members who haven't set their own password", async () => {
    expect((await listInviteCandidates(db)).map((c) => c.no)).toEqual([2, 3])
  })

  it("creates new temporary passwords, skips everyone else, and never touches own passwords", async () => {
    const { invites, skipped } = await createInvites(db, adminId, [ids.m2, ids.m3, ids.m4, ids.m5])
    expect(invites.map((i) => i.no)).toEqual([2, 3])
    expect(skipped).toBe(2) // ৪ (own password) and ৫ (cancelled)
    for (const i of invites) expect(i.pin).toMatch(/^\d{6}$/)

    const [m2] = await db.select().from(members).where(eq(members.id, ids.m2))
    expect(await bcrypt.compare(invites[0].pin, m2.pinHash!)).toBe(true) // new one works
    expect(await bcrypt.compare("111222", m2.pinHash!)).toBe(false) // the old temporary one stopped working
    expect(m2.mustChangePin).toBe(true)

    const [m4] = await db.select().from(members).where(eq(members.id, ids.m4))
    expect(await bcrypt.compare("my-own-password", m4.pinHash!)).toBe(true) // untouched
  })

  it("keeps plaintext passwords out of the audit log", async () => {
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, "invite_create"))
    expect(rows).toHaveLength(2)
    expect(JSON.stringify(rows)).not.toMatch(/\d{6}/)
  })

  it("refuses an empty selection", async () => {
    await expect(createInvites(db, adminId, [])).rejects.toThrow("বাছাই")
  })
})
