import { beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import type { PGlite } from "@electric-sql/pglite"
import type { DB } from "@/lib/db"
import { members, proposals } from "@/lib/db/schema"
import { castVote, closeExpiredProposals, closeProposal, createProposal } from "@/lib/services/proposals"
import { createTestDb } from "./helpers/test-db"

let db: DB
let pg: PGlite
let ids: number[] = []
const later = () => new Date(Date.now() + 7 * 24 * 60 * 60_000)

beforeAll(async () => {
  ;({ db, pg } = await createTestDb())
  // 5 active members + 1 cancelled
  const rows = await db
    .insert(members)
    .values(
      [1, 2, 3, 4, 5, 6].map((n) => ({
        memberNo: n,
        nameBn: `সদস্য ${n}`,
        joinedOn: "2026-10-01",
        role: n === 1 ? ("admin" as const) : ("member" as const),
        status: n === 6 ? ("cancelled" as const) : ("active" as const),
      })),
    )
    .returning()
  ids = rows.map((r) => r.id)
})

const member = (i: number) => ({ id: ids[i], status: i === 5 ? ("cancelled" as const) : ("active" as const) })

describe("proposals and votes", () => {
  it("passes with a majority when more than half voted", async () => {
    const p = await createProposal(db, ids[0], { title: "দোকান ভাড়া", description: "বিনিয়োগ", amount: 50_000, closesAt: later() })
    await castVote(db, member(0), p.id, "yes")
    await castVote(db, member(1), p.id, "yes")
    await castVote(db, member(2), p.id, "no")
    await expect(castVote(db, member(2), p.id, "yes")).rejects.toThrow("আগেই ভোট") // one vote each, no changes
    await expect(castVote(db, member(5), p.id, "yes")).rejects.toThrow("সক্রিয়") // cancelled member
    const closed = await closeProposal(db, ids[0], p.id)
    expect(closed).toMatchObject({ status: "passed", yesCount: 2, noCount: 1, activeMembersAtClose: 5 })
    await expect(castVote(db, member(3), p.id, "yes")).rejects.toThrow("শেষ")
  })

  it("is invalid when 50% or fewer voted, and a tie rejects", async () => {
    const a = await createProposal(db, ids[0], { title: "ক", description: "ক", amount: null, closesAt: later() })
    await castVote(db, member(0), a.id, "yes")
    await castVote(db, member(1), a.id, "yes")
    expect((await closeProposal(db, ids[0], a.id)).status).toBe("invalid") // 2 of 5

    const b = await createProposal(db, ids[0], { title: "খ", description: "খ", amount: null, closesAt: later() })
    for (const [i, c] of [[0, "yes"], [1, "no"], [2, "yes"], [3, "no"]] as const) await castVote(db, member(i), b.id, c)
    expect((await closeProposal(db, ids[0], b.id)).status).toBe("rejected")
  })

  it("auto-closes expired proposals", async () => {
    const p = await createProposal(db, ids[0], { title: "গ", description: "গ", amount: null, closesAt: later() })
    for (const i of [0, 1, 2]) await castVote(db, member(i), p.id, "yes")
    const n = await closeExpiredProposals(db, new Date(Date.now() + 8 * 24 * 60 * 60_000))
    expect(n).toBeGreaterThanOrEqual(1)
    const [row] = await db.select().from(proposals).where(eq(proposals.id, p.id))
    expect(row.status).toBe("passed")
    expect(row.closedBy).toBeNull() // closed by the system
  })

  it("database refuses votes on closed proposals and edits to decided ones", async () => {
    const [p] = await db.select().from(proposals).where(eq(proposals.status, "passed")).limit(1)
    await expect(pg.exec(`INSERT INTO votes (proposal_id, member_id, choice) VALUES (${p.id}, ${ids[4]}, 'yes')`)).rejects.toThrow(/closed/)
    await expect(pg.exec(`UPDATE proposals SET title = 'x' WHERE id = ${p.id}`)).rejects.toThrow(/already decided/)
    await expect(pg.exec(`DELETE FROM votes`)).rejects.toThrow(/DELETE is not allowed/)
  })

  it("an open proposal's text can't be edited", async () => {
    const p = await createProposal(db, ids[0], { title: "ঘ", description: "ঘ", amount: 100, closesAt: later() })
    await expect(pg.exec(`UPDATE proposals SET amount = 999 WHERE id = ${p.id}`)).rejects.toThrow(/only be closed/)
  })
})
