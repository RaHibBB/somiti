import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { and, eq, inArray } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { ProposalBadge } from "@/components/proposal-badge"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { getDb } from "@/lib/db"
import { votes } from "@/lib/db/schema"
import { formatDateTime, taka } from "@/lib/format"
import { closeExpiredProposals, listProposals } from "@/lib/services/proposals"

export const metadata = { title: "প্রস্তাব ও ভোট — সমিতি" }

export default async function ProposalsPage() {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const db = getDb()
  await closeExpiredProposals(db)
  const list = await listProposals(db)
  const mine = me && list.length
    ? await db
        .select({ proposalId: votes.proposalId })
        .from(votes)
        .where(and(eq(votes.memberId, me.id), inArray(votes.proposalId, list.map((p) => p.id))))
    : []
  const voted = new Set(mine.map((v) => v.proposalId))

  return (
    <div className="space-y-4">
      <PageTitle
        action={
          adminUi ? (
            <Link href="/admin/proposals/new" className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-base text-white">
              <Plus className="size-5" /> নতুন
            </Link>
          ) : null
        }
      >
        প্রস্তাব ও ভোট
      </PageTitle>
      <p className="text-sm text-muted-foreground">
        এক সদস্য এক ভোট। সক্রিয় সদস্যের অর্ধেকের বেশি ভোট দিলে ভোট বৈধ; &quot;হ্যাঁ&quot; বেশি হলে প্রস্তাব পাস।
      </p>
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/proposals/${p.id}`} className="flex items-center gap-3 rounded-xl border bg-white p-3 active:bg-muted">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ProposalBadge status={p.status} />
                  {p.status === "open" && me ? (
                    voted.has(p.id) ? (
                      <span className="text-sm text-green-700">✓ আপনি ভোট দিয়েছেন</span>
                    ) : (
                      <span className="text-sm font-semibold text-destructive">আপনার ভোট বাকি</span>
                    )
                  ) : null}
                </div>
                <p className="truncate text-base font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">
                  {p.amount ? `${taka(p.amount)} · ` : ""}
                  {p.status === "open" && p.closesAt ? `শেষ: ${formatDateTime(p.closesAt)}` : p.closedAt ? `বন্ধ: ${formatDateTime(p.closedAt)}` : ""}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
        {list.length === 0 ? <li className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কোনো প্রস্তাব নেই</li> : null}
      </ul>
    </div>
  )
}
