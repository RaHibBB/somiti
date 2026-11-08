import { beforeAll, describe, expect, it, vi } from "vitest"
import type { DB } from "@/lib/db"
import { members, settings } from "@/lib/db/schema"
import { loadFund, loadProjects } from "@/lib/data"
import { fundSummary } from "@/lib/ledger"
import { computeDistribution, samitiYear, type DatedTxn, type ProfitMember } from "@/lib/profit"
import { categoryBreakdown, projectStates, projectTotals } from "@/lib/projects"
import { closeProject, createProject, reopenProject } from "@/lib/services/projects"
import { saveDistribution } from "@/lib/services/profit"
import { createTransaction } from "@/lib/services/transactions"
import { voidTransaction } from "@/lib/services/void"
import { UserError } from "@/lib/services/errors"
import { createTestDb } from "./helpers/test-db"

// A cow: bought 80,000, costs 17,000 (feed, medicine, transport), sold 120,000 → profit 23,000.
const COW = 1
const cow = (type: DatedTxn["type"], amount: number, date = "2027-01-10", category?: string): DatedTxn & { category?: string } => ({
  projectId: COW,
  type,
  amount,
  status: "valid",
  date,
  category,
})

describe("project totals (pure)", () => {
  const entries = [
    cow("investment", 80_000, "2027-01-01", "কেনা"),
    cow("expense", 12_000, "2027-02-01", "খাবার"),
    cow("expense", 3_000, "2027-02-10", "ওষুধ ও ডাক্তার"),
    cow("expense", 2_000, "2027-02-11", "পরিবহন"),
    { ...cow("expense", 9_999), status: "void" as const },
  ]

  it("adds purchase, costs and income; void rows don't count", () => {
    expect(projectTotals(entries)).toEqual({ capital: 80_000, costs: 17_000, income: 0, spent: 97_000, result: -97_000, tied: 97_000 })
    const sold = projectTotals([...entries, cow("business_income", 120_000, "2027-06-01", "বিক্রি")])
    expect(sold).toMatchObject({ income: 120_000, result: 23_000, tied: 0 })
  })

  it("groups by heading, purchase first", () => {
    const b = categoryBreakdown(entries)
    expect(b[0]).toEqual({ kind: "capital", category: "কেনা", amount: 80_000 })
    expect(b.map((x) => x.category)).toEqual(["কেনা", "খাবার", "ওষুধ ও ডাক্তার", "পরিবহন"])
  })

  it("state comes from the latest close/reopen event", () => {
    const st = projectStates([
      { id: 1, projectId: 1, kind: "close", eventDate: "2027-06-01" },
      { id: 2, projectId: 1, kind: "reopen", eventDate: "2027-06-02" },
      { id: 3, projectId: 2, kind: "close", eventDate: "2027-07-01" },
    ])
    expect(st.get(1)).toEqual({ closed: false, closedOn: null })
    expect(st.get(2)).toEqual({ closed: true, closedOn: "2027-07-01" })
  })
})

describe("fund with projects (pure)", () => {
  const dues = 150_000
  const bought = [cow("investment", 80_000), cow("expense", 17_000)]

  it("money spent on an open project is invested, not lost: the total fund doesn't change", () => {
    const f = fundSummary(dues, bought)
    expect(f.cash).toBe(53_000)
    expect(f.invested).toBe(97_000)
    expect(f.inProjects).toBe(97_000)
    expect(f.total).toBe(150_000)
  })

  it("after the sale the profit shows in the total, open or closed", () => {
    const sold = [...bought, cow("business_income", 120_000)]
    const open = fundSummary(dues, sold)
    expect(open).toMatchObject({ cash: 173_000, invested: 0, total: 173_000 })
    const closed = fundSummary(dues, sold, 70, new Set([COW]))
    expect(closed).toMatchObject({ cash: 173_000, invested: 0, total: 173_000 })
  })

  it("a closed project with a loss ties up nothing", () => {
    const loss = [...bought, cow("business_income", 50_000)]
    expect(fundSummary(dues, loss, 70, new Set([COW]))).toMatchObject({ cash: 103_000, invested: 0, total: 103_000 })
  })

  it("general investments keep the old rule (investment − return)", () => {
    const f = fundSummary(dues, [{ type: "investment", amount: 30_000, status: "valid" }, { type: "investment_return", amount: 10_000, status: "valid" }, ...bought])
    expect(f.invested).toBe(20_000 + 97_000)
  })
})

describe("yearly profit with projects (pure)", () => {
  const year = samitiYear("2026-10-01", 0) // Oct 2026 – Sep 2027
  const members: ProfitMember[] = [{ id: 1, memberNo: 1, name: "এক", active: true, history: [{ id: 1, shares: 1, effectiveMonth: "2026-10-01" }] }]
  const txns: DatedTxn[] = [
    cow("investment", 80_000, "2027-01-01"),
    cow("expense", 17_000, "2027-02-01"),
    cow("business_income", 120_000, "2027-06-01"),
    { type: "bank_profit", amount: 1_000, status: "valid", date: "2027-03-01" },
    { type: "expense", amount: 500, status: "valid", date: "2027-03-01" },
  ]
  const base = { ...year, members, reservePct: 50, txns }

  it("a project closed in the year adds its whole result; its entries are not counted on their own", () => {
    const r = computeDistribution({ ...base, projects: [{ id: COW, name: "গরু", closedOn: "2027-06-15" }] })
    expect(r.income).toBe(1_000)
    expect(r.expense).toBe(500)
    expect(r.projectProfit).toBe(23_000)
    expect(r.projects).toEqual([{ id: COW, name: "গরু", closedOn: "2027-06-15", result: 23_000 }])
    expect(r.profit).toBe(23_500)
  })

  it("an open project, or one closed in another year, adds nothing", () => {
    expect(computeDistribution({ ...base, projects: [{ id: COW, name: "গরু", closedOn: null }] }).profit).toBe(500)
    expect(computeDistribution({ ...base, projects: [{ id: COW, name: "গরু", closedOn: "2027-10-01" }] }).profit).toBe(500)
    // …and counts in the year it did close, even though the purchase was the year before.
    const next = computeDistribution({ ...samitiYear("2026-10-01", 1), members, reservePct: 50, txns, projects: [{ id: COW, name: "গরু", closedOn: "2027-10-01" }] })
    expect(next.profit).toBe(23_000)
  })

  it("a loss-making project lowers the year's profit", () => {
    const lossTxns = txns.map((t) => (t.type === "business_income" && t.projectId ? { ...t, amount: 90_000 } : t))
    const r = computeDistribution({ ...base, txns: lossTxns, projects: [{ id: COW, name: "গরু", closedOn: "2027-06-15" }] })
    expect(r.projectProfit).toBe(-7_000)
    expect(r.profit).toBe(-6_500)
    expect(r.distributedAmount).toBe(0)
  })
})

describe("project services (database)", () => {
  let db: DB
  let adminId: number
  const entry = (projectId: number, type: DatedTxn["type"], amount: number, date: string, category: string | null = null) => ({
    date,
    type,
    description: `${category ?? type} ${amount}`,
    amount,
    approvedBy: null,
    receiptUrl: null,
    meetingDate: null,
    voteResult: null,
    projectId,
    category,
  })

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2027-11-15T06:00:00Z")) // samiti year 2 (Oct 2027 – Sep 2028)
    ;({ db } = await createTestDb())
    const [a] = await db.insert(members).values({ memberNo: 1, nameBn: "অ্যাডমিন", phone: "01859336893", role: "admin", joinedOn: "2026-10-01" }).returning()
    adminId = a.id
    const [s] = await db.select().from(settings).limit(1)
    expect(s.startMonth).toBe("2026-10-01")
  })

  it("records a cow from purchase to sale, and the fund follows", async () => {
    const p = await createProject(db, adminId, { name: "কোরবানির গরু", description: null, startedOn: "2027-10-01", proposalId: null, budget: 100_000 })
    await createTransaction(db, adminId, entry(p.id, "investment", 80_000, "2027-10-02", "কেনা"))
    await createTransaction(db, adminId, entry(p.id, "expense", 12_000, "2027-10-20", "খাবার"))
    let fund = await loadFund(db)
    expect(fund.inProjects).toBe(92_000)
    await createTransaction(db, adminId, entry(p.id, "business_income", 120_000, "2027-11-10", "বিক্রি"))
    await closeProject(db, adminId, p.id, "2027-11-12", "হাটে বিক্রি")
    fund = await loadFund(db)
    expect(fund.inProjects).toBe(0)
    const [view] = await loadProjects(db)
    expect(view).toMatchObject({ closed: true, closedOn: "2027-11-12" })
    expect(view.totals.result).toBe(28_000)
  })

  it("refuses wrong entries", async () => {
    const p = await createProject(db, adminId, { name: "ছাগল", description: null, startedOn: "2027-11-01", proposalId: null, budget: null })
    await expect(createTransaction(db, adminId, entry(p.id, "bank_profit", 100, "2027-11-02"))).rejects.toThrow("প্রকল্পে শুধু")
    await expect(createTransaction(db, adminId, entry(p.id, "expense", 100, "2027-10-30"))).rejects.toThrow("শুরুর")
    await expect(createProject(db, adminId, { name: " ", description: null, startedOn: "2027-11-01", proposalId: null, budget: null })).rejects.toThrow("নাম")
    await expect(createProject(db, adminId, { name: "ভবিষ্যৎ", description: null, startedOn: "2027-12-01", proposalId: null, budget: null })).rejects.toThrow("ভবিষ্যতের")
  })

  it("a closed project can't take or lose entries until it is reopened with a reason", async () => {
    const p = await createProject(db, adminId, { name: "মুরগি", description: null, startedOn: "2027-11-01", proposalId: null, budget: null })
    await expect(closeProject(db, adminId, p.id, "2027-11-05", null)).rejects.toThrow("কোনো এন্ট্রি নেই")
    const t = await createTransaction(db, adminId, entry(p.id, "investment", 5_000, "2027-11-03"))
    await expect(closeProject(db, adminId, p.id, "2027-11-02", null)).rejects.toThrow("শেষ এন্ট্রির")
    await closeProject(db, adminId, p.id, "2027-11-05", null)
    await expect(createTransaction(db, adminId, entry(p.id, "expense", 100, "2027-11-06"))).rejects.toThrow("শেষ করা আছে")
    await expect(voidTransaction(db, adminId, t.id, "ভুল")).rejects.toThrow("শেষ করা আছে")
    await expect(closeProject(db, adminId, p.id, "2027-11-06", null)).rejects.toThrow("শেষ করা আছে")
    await expect(reopenProject(db, adminId, p.id, "x")).rejects.toThrow("কারণ")
    await reopenProject(db, adminId, p.id, "আরও খরচ বাকি ছিল")
    await expect(reopenProject(db, adminId, p.id, "আবার")).rejects.toThrow("চালু আছে")
    await expect(voidTransaction(db, adminId, t.id, "ভুল এন্ট্রি")).resolves.toBeTruthy()
  })

  it("after a year's profit is distributed, a project can't be closed or reopened inside that year", async () => {
    // Year 1 (Oct 2026 – Sep 2027): a small project closed in it, then the year is distributed.
    const p = await createProject(db, adminId, { name: "পুরনো প্রকল্প", description: null, startedOn: "2027-01-01", proposalId: null, budget: null })
    await createTransaction(db, adminId, entry(p.id, "investment", 1_000, "2027-01-02"))
    await createTransaction(db, adminId, entry(p.id, "business_income", 3_000, "2027-03-01"))
    await closeProject(db, adminId, p.id, "2027-03-01", null)
    await saveDistribution(db, adminId, 0, { recordDividend: false, paidOn: "2027-11-01" })
    await expect(reopenProject(db, adminId, p.id, "ভুল ছিল")).rejects.toThrow("মুনাফা বণ্টনে ধরা হয়ে গেছে")

    const q = await createProject(db, adminId, { name: "দেরিতে শেষ", description: null, startedOn: "2027-02-01", proposalId: null, budget: null })
    await createTransaction(db, adminId, entry(q.id, "investment", 1_000, "2027-02-02"))
    await expect(closeProject(db, adminId, q.id, "2027-09-30", null)).rejects.toThrow("আগেই সংরক্ষণ")
    await expect(closeProject(db, adminId, q.id, "2027-10-01", null)).resolves.toBeTruthy()
  })

  it("the database itself refuses deleting projects and editing their history", async () => {
    await expect(db.execute("DELETE FROM projects")).rejects.toThrow()
    await expect(db.execute("UPDATE project_events SET reason = 'x'")).rejects.toThrow()
    await expect(db.execute("DELETE FROM project_events")).rejects.toThrow()
    await expect(
      db.execute("INSERT INTO transactions (date, type, description, amount, project_id) VALUES ('2027-11-01', 'bank_profit', 'x', 1, 1)"),
    ).rejects.toThrow()
  })

  it("is a user-facing error type", async () => {
    await expect(closeProject(db, adminId, 9999, "2027-11-01", null)).rejects.toBeInstanceOf(UserError)
  })
})
