import { desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { proposals } from "@/lib/db/schema"
import { getSnapshot, loadFund, loadProjects } from "@/lib/data"
import { todayDhaka } from "@/lib/format"
import { TransactionForm } from "./txn-form"

export default async function NewTransactionPage({ searchParams }: PageProps<"/admin/transactions/new">) {
  const me = await requireAdmin()
  const db = getDb()
  const sp = await searchParams
  const [fund, snap, passed, allProjects] = await Promise.all([
    loadFund(db),
    getSnapshot(),
    db
      .select({ id: proposals.id, title: proposals.title, amount: proposals.amount })
      .from(proposals)
      .where(eq(proposals.status, "passed"))
      .orderBy(desc(proposals.closedAt)),
    loadProjects(db),
  ])
  const openProjects = allProjects.filter((p) => !p.closed).map((p) => ({ id: p.id, name: p.name, startedOn: p.startedOn }))
  const wanted = Number(sp.project)
  const initialProjectId = openProjects.some((p) => p.id === wanted) ? wanted : null
  const kind = typeof sp.kind === "string" && ["capital", "cost", "income"].includes(sp.kind) ? (sp.kind as "capital" | "cost" | "income") : null
  const admins = snap.members.filter((m) => m.member.status === "active" && m.member.role === "admin").map((m) => ({ id: m.member.id, name: m.member.nameBn }))
  return (
    <>
      <PageTitle>আয়/ব্যয়/বিনিয়োগ যোগ</PageTitle>
      <TransactionForm
        today={todayDhaka()}
        fund={{ cash: fund.cash, invested: fund.invested, minCashPct: fund.minCashPct }}
        proposals={passed}
        admins={admins}
        meId={me.id}
        projects={openProjects}
        initialProjectId={initialProjectId}
        initialKind={kind}
      />
    </>
  )
}
