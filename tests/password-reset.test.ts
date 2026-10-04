import { beforeAll, describe, expect, it } from "vitest"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { members, passwordResets } from "@/lib/db/schema"
import { checkResetToken, createResetToken, MAX_RESETS_PER_HOUR, resetPasswordWithToken } from "@/lib/services/password-reset"
import { createTestDb } from "./helpers/test-db"

let db: DB
let memberId: number

beforeAll(async () => {
  ;({ db } = await createTestDb())
  const [m] = await db
    .insert(members)
    .values({
      memberNo: 1,
      nameBn: "রহিম",
      email: "rahim@example.com",
      joinedOn: "2026-10-01",
      pinHash: await bcrypt.hash("old-pass-1", 4),
      mustChangePin: true,
    })
    .returning()
  memberId = m.id
})

describe("password reset", () => {
  it("returns null for unknown or malformed emails (no account discovery)", async () => {
    expect(await createResetToken(db, "nobody@example.com")).toBeNull()
    expect(await createResetToken(db, "not-an-email")).toBeNull()
  })

  it("issues a token (case-insensitive email), stores only its hash, and resets once", async () => {
    const req = await createResetToken(db, "  RAHIM@example.com ")
    expect(req?.member.id).toBe(memberId)
    const [row] = await db.select().from(passwordResets).where(eq(passwordResets.memberId, memberId))
    expect(row.tokenHash).not.toBe(req!.token)
    expect(await checkResetToken(db, req!.token)).toBe(true)

    const before = (await db.select().from(members).where(eq(members.id, memberId)))[0]
    const m = await resetPasswordWithToken(db, req!.token, "new-pass-22")
    expect(await bcrypt.compare("new-pass-22", m.pinHash!)).toBe(true)
    expect(m.mustChangePin).toBe(false)
    expect(m.sessionVersion).toBe(before.sessionVersion + 1)

    expect(await checkResetToken(db, req!.token)).toBe(false)
    await expect(resetPasswordWithToken(db, req!.token, "another-pass-3")).rejects.toThrow("মেয়াদ")
  })

  it("rejects expired tokens and weak passwords", async () => {
    const past = new Date(Date.now() - 2 * 60 * 60_000)
    const req = await createResetToken(db, "rahim@example.com", past)
    expect(await checkResetToken(db, req!.token)).toBe(false)
    await expect(resetPasswordWithToken(db, req!.token, "fine-password-9")).rejects.toThrow("মেয়াদ")
    const fresh = await createResetToken(db, "rahim@example.com")
    await expect(resetPasswordWithToken(db, fresh!.token, "123456")).rejects.toThrow("সহজ")
  })

  it("rate-limits reset emails per member", async () => {
    // Two requests were already made in the last hour above (plus one backdated).
    let last = null
    for (let i = 0; i < MAX_RESETS_PER_HOUR; i++) last = await createResetToken(db, "rahim@example.com")
    expect(last).toBeNull()
  })

  it("never deletes reset rows", async () => {
    await expect(db.delete(passwordResets)).rejects.toThrow()
  })
})
