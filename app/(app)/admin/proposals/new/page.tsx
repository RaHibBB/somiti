import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { loadFund } from "@/lib/data"
import { todayDhaka } from "@/lib/format"
import { ProposalForm } from "./proposal-form"

export default async function NewProposalPage() {
  await requireAdmin()
  const fund = await loadFund()
  const today = todayDhaka()
  const inAWeek = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 24 * 60 * 60_000).toISOString().slice(0, 10)
  return (
    <>
      <PageTitle>নতুন প্রস্তাব</PageTitle>
      <ProposalForm
        defaultCloseOn={inAWeek}
        minCloseOn={today}
        fund={{ cash: fund.cash, invested: fund.invested, minCashPct: fund.minCashPct }}
      />
    </>
  )
}
