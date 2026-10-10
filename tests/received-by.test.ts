import { beforeAll, describe, expect, it, vi } from "vitest"
import { members } from "@/lib/db/schema"
import type { DB } from "@/lib/db"
import { createMember } from "@/lib/services/members"
import { recordPayments } from "@/lib/services/payments"
import { UserError } from "@/lib/services/errors"
import { createTestDb } from "./helpers/test-db"

let db: DB
let adminId: number
let otherAdminId: number
let memberId: number

const base = { email: null, role: "member" as const, joinedOn: "2026-10-01", nomineeName: null, nomineePhone: null, notes: null }
const pay = (extra: { receivedBy?: number }, ref: string) => ({
  memberId,
  items: [{ forMonth: "2026-10-01", amount: 500 }],
  paidOn: "2026-11-05",
  method: "cash" as const,
  trxId: null,
  note: null,
  clientRef: ref,
  ...extra,
})

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2027-06-01T06:00:00Z"))
  ;({ db } = await createTestDb())
  const [a, b] = await db
    .insert(members)
    .values([
      { memberNo: 1, nameBn: "অ্যাডমিন এক", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" },
      { memberNo: 2, nameBn: "অ্যাডমিন দুই", phone: "01711111111", role: "admin", joinedOn: "2026-10-01" },
    ])
    .returning()
  adminId = a.id
  otherAdminId = b.id
  const created = await createMember(db, adminId, { ...base, memberNo: 3, nameBn: "রহিম", phone: null, shares: 1, shareStartMonth: "2026-10-01" })
  memberId = created.member.id
})

describe("received-by", () => {
  it("defaults to the admin who enters the payment", async () => {
    const [row] = await recordPayments(db, adminId, pay({}, "r1"))
    expect(row.receivedBy).toBe(adminId)
  })

  it("records another admin as the one holding the money", async () => {
    const [row] = await recordPayments(db, adminId, { ...pay({ receivedBy: otherAdminId }, "r2"), items: [{ forMonth: "2026-11-01", amount: 500 }] })
    expect(row.receivedBy).toBe(otherAdminId)
  })

  it("refuses a receiver who is not an active admin", async () => {
    await expect(
      recordPayments(db, adminId, { ...pay({ receivedBy: memberId }, "r3"), items: [{ forMonth: "2026-12-01", amount: 500 }] }),
    ).rejects.toBeInstanceOf(UserError)
  })
})
