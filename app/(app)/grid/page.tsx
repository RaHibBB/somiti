import { PageTitle } from "@/components/layout/page-title"
import { getViewer } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { monthLabel, monthShort, taka, toBn } from "@/lib/format"
import { monthOf, type MonthStatus } from "@/lib/ledger"
import { cn } from "@/lib/utils"
import { ScrollToCurrent } from "./scroll-to-current"

export const metadata = { title: "মাসিক গ্রিড — সমিতি" }

const CELL: Record<MonthStatus, { cls: string; mark: string; label: string }> = {
  paid: { cls: "cell-paid", mark: "✓", label: "পরিশোধিত" },
  partial: { cls: "cell-partial", mark: "◐", label: "আংশিক" },
  unpaid: { cls: "cell-unpaid", mark: "✗", label: "বকেয়া" },
  not_yet_due: { cls: "cell-future", mark: "", label: "সময় হয়নি" },
}

export default async function GridPage() {
  await getViewer()
  const snap = await getSnapshot()
  const months = snap.members[0]?.lines.map((l) => l.month) ?? []
  const thisMonth = monthOf(snap.today)
  const rows = snap.members.filter((m) => m.member.status === "active" || m.paid > 0)

  return (
    <div className="space-y-3">
      <PageTitle>মাসিক গ্রিড</PageTitle>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {(Object.keys(CELL) as MonthStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={cn("inline-flex size-5 items-center justify-center rounded text-xs", CELL[s].cls)}>{CELL[s].mark}</span>
            {CELL[s].label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">ডানে-বামে সরিয়ে সব মাস দেখুন। ঘরে চাপ দিলে বিস্তারিত দেখাবে।</p>

      <div id="grid-scroll" className="-mx-4 overflow-x-auto border-y bg-white lg:mx-0 lg:rounded-xl lg:border">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-32 border-r border-b bg-white px-2 py-2 text-left font-semibold">সদস্য</th>
              {months.map((m) => (
                <th
                  key={m}
                  data-current={m === thisMonth ? "true" : undefined}
                  className={cn(
                    "min-w-12 border-b px-1 py-2 text-center text-xs font-medium whitespace-nowrap",
                    m === thisMonth && "bg-secondary text-brand-navy",
                  )}
                >
                  {monthShort(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member.id}>
                <th className="sticky left-0 z-10 max-w-36 min-w-32 border-r border-b bg-white px-2 py-1 text-left font-normal">
                  <a href={`/members/${r.member.id}`} className="block truncate">
                    <span className="text-muted-foreground">{toBn(r.member.memberNo)}.</span> {r.member.nameBn}
                  </a>
                  {r.due > 0 ? <span className="block text-xs text-destructive">{taka(r.due)}</span> : null}
                </th>
                {r.lines.map((l) => {
                  const c = CELL[l.status]
                  return (
                    <td key={l.month} className="border-b border-white p-0.5">
                      <div
                        title={`${r.member.nameBn} — ${monthLabel(l.month)}: ${taka(l.paid)} / ${taka(l.expected)} (${c.label})`}
                        className={cn("flex h-9 items-center justify-center rounded text-sm", c.cls)}
                      >
                        {c.mark}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ScrollToCurrent />
    </div>
  )
}
