import { beforeAll, describe, expect, it } from "vitest"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members } from "@/lib/db/schema"
import { authenticate, BAD_LOGIN } from "@/lib/auth/authenticate"
import { createMember } from "@/lib/services/members"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let fatherId: number
let sonId: number
const PHONE = "01711223344"
const byPhone = { kind: "phone" as const, phone: PHONE }

const counters = async (id: number) => (await db.select({ f: members.failedLogins, l: members.lockedUntil }).from(members).where(eq(members.id, id)))[0]

beforeAll(async () => {
  ;({ db } = await createTestDb())
  const [a] = await db.insert(members).values({ memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" }).returning()
  adminId = a.id
  const base = { email: null, role: "member" as const, joinedOn: "2026-10-01", nomineeName: null, nomineePhone: null, notes: null, shares: 1, shareStartMonth: "2026-10-01" }
  // Two members of one family, one mobile number: allowed now.
  fatherId = (await createMember(db, adminId, { ...base, memberNo: 2, nameBn: "বাবা", phone: PHONE })).member.id
  sonId = (await createMember(db, adminId, { ...base, memberNo: 3, nameBn: "ছেলে", phone: PHONE })).member.id
  await db.update(members).set({ pinHash: await bcrypt.hash("baba-secret", 4), mustChangePin: false }).where(eq(members.id, fatherId))
  await db.update(members).set({ pinHash: await bcrypt.hash("chele-secret", 4), mustChangePin: false }).where(eq(members.id, sonId))
})

describe("a mobile number shared by two members", () => {
  it("each logs in with the number and their own password", async () => {
    const f = await authenticate(db, byPhone, "baba-secret")
    const s = await authenticate(db, byPhone, "chele-secret")
    expect(f.ok && f.member.id).toBe(fatherId)
    expect(s.ok && s.member.id).toBe(sonId)
    expect(await counters(fatherId)).toMatchObject({ f: 0, l: null })
    expect(await counters(sonId)).toMatchObject({ f: 0, l: null })
  })

  it("a wrong password counts once for each; the right one later gives the other their attempt back", async () => {
    expect(await authenticate(db, byPhone, "wrong-one")).toEqual({ ok: false, error: BAD_LOGIN })
    expect((await counters(fatherId)).f).toBe(1)
    expect((await counters(sonId)).f).toBe(1)
    const s = await authenticate(db, byPhone, "chele-secret")
    expect(s.ok).toBe(true)
    expect((await counters(sonId)).f).toBe(0) // cleared: correct login
    expect((await counters(fatherId)).f).toBe(1) // his earlier failure stays; this attempt was given back
  })

  it("member number still logs in exactly that member", async () => {
    const r = await authenticate(db, { kind: "memberNo", memberNo: 2 }, "baba-secret")
    expect(r.ok && r.member.id).toBe(fatherId)
    expect((await authenticate(db, { kind: "memberNo", memberNo: 2 }, "chele-secret")).ok).toBe(false)
  })

  it("if both use the same password, the number alone is not enough", async () => {
    await db.update(members).set({ pinHash: await bcrypt.hash("same-pass", 4) }).where(eq(members.id, sonId))
    await db.update(members).set({ pinHash: await bcrypt.hash("same-pass", 4) }).where(eq(members.id, fatherId))
    const r = await authenticate(db, byPhone, "same-pass")
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain("সদস্য নম্বর দিয়ে লগইন")
    expect((await authenticate(db, { kind: "memberNo", memberNo: 3 }, "same-pass")).ok).toBe(true)
  })

  it("a cancelled member with the number doesn't block the active one", async () => {
    await db.update(members).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "পরীক্ষা" }).where(eq(members.id, fatherId))
    const r = await authenticate(db, byPhone, "same-pass")
    expect(r.ok && r.member.id).toBe(sonId)
  })

  it("five wrong tries lock each account, as before", async () => {
    await db.update(members).set({ failedLogins: 0, lockedUntil: null }).where(eq(members.id, sonId))
    let last = await authenticate(db, byPhone, "x-wrong")
    for (let i = 0; i < 4; i++) last = await authenticate(db, byPhone, "x-wrong")
    expect(!last.ok && last.error).toContain("বন্ধ")
    expect((await counters(sonId)).l).not.toBeNull()
    expect(await authenticate(db, byPhone, "same-pass")).toMatchObject({ ok: false })
  })
})
