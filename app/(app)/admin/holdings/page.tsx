import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { METHOD_LABELS, taka, toBn } from "@/lib/format"

export const metadata = { title: "কার কাছে কত টাকা — সমিতি" }

const DIGITAL = ["bkash", "nagad", "rocket", "bank"] as const

/** Who took the money (every valid payment records the admin who received it). */
export default async function HoldingsPage() {
  await requireAdmin()
  const snap = await getSnapshot()
  const byId = new Map(snap.members.map((m) => [m.member.id, m.member]))
  const valid = snap.members.flatMap((m) => m.payments).filter((p) => p.status === "valid")
  const monthPrefix = snap.today.slice(0, 7)

  type Row = { id: number | null; name: string; cash: number; digital: Record<string, number>; total: number; count: number; monthTotal: number }
  const rows = new Map<number | null, Row>()
  for (const p of valid) {
    const key = p.receivedBy ?? null
    let r = rows.get(key)
    if (!r) {
      r = { id: key, name: key ? (byId.get(key)?.nameBn ?? "অজানা") : "অজানা (পুরোনো এন্ট্রি)", cash: 0, digital: {}, total: 0, count: 0, monthTotal: 0 }
      rows.set(key, r)
    }
    if (p.method === "cash") r.cash += p.amount
    else r.digital[p.method] = (r.digital[p.method] ?? 0) + p.amount
    r.total += p.amount
    r.count += 1
    if (p.paidOn.startsWith(monthPrefix)) r.monthTotal += p.amount
  }
  const list = [...rows.values()].sort((a, b) => b.total - a.total)
  const grand = list.reduce((s, r) => s + r.total, 0)

  return (
    <div className="space-y-4">
      <PageTitle>কার কাছে কত টাকা</PageTitle>
      <p className="text-base text-muted-foreground">
        জমা নেওয়ার সময় যাঁর কাছে টাকা জমা আছে বলে লেখা হয়েছে, তাঁর নামে হিসাব। বাতিল রসিদ ধরা হয়নি।
      </p>
      <div className="rounded-xl bg-secondary p-3">
        <p className="text-sm text-muted-foreground">মোট আদায় (সব সময়)</p>
        <p className="text-2xl font-bold text-brand-navy">{taka(grand)}</p>
      </div>
      {list.length === 0 ? <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">এখনো কোনো জমা নেই</p> : null}
      <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {list.map((r) => (
          <li key={r.id ?? "x"} className="rounded-xl border bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-base font-semibold">{r.name}</p>
              <p className="text-xl font-bold text-brand-navy">{taka(r.total)}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {toBn(r.count)}টি জমা · এ মাসে {taka(r.monthTotal)}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt>{METHOD_LABELS.cash} (হাতে নগদ)</dt>
              <dd className="text-right font-medium">{taka(r.cash)}</dd>
              {DIGITAL.filter((m) => r.digital[m]).map((m) => (
                <div key={m} className="contents">
                  <dt>{METHOD_LABELS[m]}</dt>
                  <dd className="text-right font-medium">{taka(r.digital[m])}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}
