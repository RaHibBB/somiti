import { desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { proposals } from "@/lib/db/schema"
import { loadFund } from "@/lib/data"
import { todayDhaka } from "@/lib/format"
import { TransactionForm } from "./txn-form"

export default async function NewTransactionPage() {
  await requireAdmin()
  const db = getDb()
  const [fund, passed] = await Promise.all([
    loadFund(db),
    db
      .select({ id: proposals.id, title: proposals.title, amount: proposals.amount })
      .from(proposals)
      .where(eq(proposals.status, "passed"))
      .orderBy(desc(proposals.closedAt)),
  ])
  return (
    <>
      <PageTitle>আয়/ব্যয়/বিনিয়োগ যোগ</PageTitle>
      <TransactionForm
        today={todayDhaka()}
        fund={{ cash: fund.cash, invested: fund.invested, minCashPct: fund.minCashPct }}
        proposals={passed}
      />
    </>
  )
}
