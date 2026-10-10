import Link from "next/link"
import { Pencil } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { METHOD_LABELS, monthLabel, taka, toBn } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata = { title: "কার কাছে কত টাকা — সমিতি" }

const DIGITAL = ["bkash", "nagad", "rocket", "bank"] as const

type Row = { id: number | null; name: string; cash: number; digital: Record<string, number>; total: number; count: number }

/** Who took the money, overall or for one month (by the date the money was received). */
export default async function HoldingsPage({ searchParams }: PageProps<"/admin/holdings">) {
  await requireAdmin()
  const snap = await getSnapshot()
  const byId = new Map(snap.members.map((m) => [m.member.id, m.member]))
  const valid = snap.members.flatMap((m) => m.payments).filter((p) => p.status === "valid")

  // Months in which money was actually received, newest first.
  const months = [...new Set(valid.map((p) => p.paidOn.slice(0, 7)))].sort().reverse()
  const raw = (await searchParams).month
  const month = typeof raw === "string" && months.includes(raw) ? raw : null
  const scoped = month ? valid.filter((p) => p.paidOn.startsWith(month)) : valid

  const nameOf = (id: number | null) => (id ? (byId.get(id)?.nameBn ?? "অজানা") : "অজানা (পুরোনো এন্ট্রি)")
  const build = (pays: typeof valid) => {
    const rows = new Map<number | null, Row>()
    for (const p of pays) {
      const key = p.receivedBy ?? null
      let r = rows.get(key)
      if (!r) {
        r = { id: key, name: nameOf(key), cash: 0, digital: {}, total: 0, count: 0 }
        rows.set(key, r)
      }
      if (p.method === "cash") r.cash += p.amount
      else r.digital[p.method] = (r.digital[p.method] ?? 0) + p.amount
      r.total += p.amount
      r.count += 1
    }
    return [...rows.values()].sort((a, b) => b.total - a.total)
  }
  const list = build(scoped)
  const grand = list.reduce((s, r) => s + r.total, 0)

  // Month × holder table.
  const holders = build(valid)
  const matrix = months.map((m) => {
    const inMonth = valid.filter((p) => p.paidOn.startsWith(m))
    const per = new Map<number | null, number>()
    for (const p of inMonth) per.set(p.receivedBy ?? null, (per.get(p.receivedBy ?? null) ?? 0) + p.amount)
    return { month: m, per, total: inMonth.reduce((s, p) => s + p.amount, 0) }
  })

  const chip = (active: boolean) =>
    cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", active ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white")

  return (
    <div className="space-y-4">
      <PageTitle>কার কাছে কত টাকা</PageTitle>
      <p className="text-base text-muted-foreground">
        জমা নেওয়ার সময় যাঁর কাছে টাকা জমা আছে বলে লেখা হয়েছে, তাঁর নামে হিসাব। মাস বাছলে ওই মাসে (যে তারিখে টাকা হাতে এসেছে) আদায়ের হিসাব দেখায়। বাতিল রসিদ ধরা হয়নি।
      </p>
      <Link href="/admin/holdings/fix" className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand-navy bg-white text-base font-semibold text-brand-navy">
        <Pencil className="size-5" /> ভুল হলে সংশোধন করুন
      </Link>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/admin/holdings" className={chip(!month)}>
          সব মাস
        </Link>
        {months.map((m) => (
          <Link key={m} href={`/admin/holdings?month=${m}`} className={chip(month === m)}>
            {monthLabel(`${m}-01`)}
          </Link>
        ))}
      </div>

      <div className="rounded-xl bg-secondary p-3">
        <p className="text-sm text-muted-foreground">{month ? `${monthLabel(`${month}-01`)}-এ মোট আদায়` : "মোট আদায় (সব সময়)"}</p>
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
            <p className="text-sm text-muted-foreground">{toBn(r.count)}টি জমা</p>
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

      {matrix.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">মাসভিত্তিক সারণি</h2>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="bg-secondary text-left">
                  <th className="px-3 py-2">মাস</th>
                  {holders.map((h) => (
                    <th key={h.id ?? "x"} className="px-3 py-2 text-right">
                      {h.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">মোট</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matrix.map((row) => (
                  <tr key={row.month}>
                    <td className="px-3 py-2">
                      <Link href={`/admin/holdings?month=${row.month}`} className="text-brand-navy underline">
                        {monthLabel(`${row.month}-01`)}
                      </Link>
                    </td>
                    {holders.map((h) => (
                      <td key={h.id ?? "x"} className="px-3 py-2 text-right">
                        {row.per.get(h.id) ? taka(row.per.get(h.id) ?? 0) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold">{taka(row.total)}</td>
                  </tr>
                ))}
                <tr className="bg-secondary font-semibold">
                  <td className="px-3 py-2">সব মাস</td>
                  {holders.map((h) => (
                    <td key={h.id ?? "x"} className="px-3 py-2 text-right">
                      {taka(h.total)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">{taka(valid.reduce((s, p) => s + p.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
