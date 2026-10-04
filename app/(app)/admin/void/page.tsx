import { desc, eq, ilike, or } from "drizzle-orm"
import { Search } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { Input } from "@/components/ui/input"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { members, payments, transactions } from "@/lib/db/schema"
import { formatDate, fromBn, METHOD_LABELS, monthLabel, receiptLabel, taka, TXN_TYPE_LABELS } from "@/lib/format"
import { VoidButton } from "./void-button"

export default async function VoidPage({ searchParams }: PageProps<"/admin/void">) {
  await requireAdmin()
  const raw = (await searchParams).q
  const q = typeof raw === "string" ? fromBn(raw.trim()) : ""
  const receiptNo = /^(r-?)?0*\d+$/i.test(q) ? Number(q.replace(/\D/g, "")) : null
  const db = getDb()

  const payWhere = q
    ? receiptNo !== null
      ? eq(payments.receiptNo, receiptNo)
      : ilike(members.nameBn, `%${q}%`)
    : undefined
  const pays = await db
    .select({ p: payments, name: members.nameBn, no: members.memberNo })
    .from(payments)
    .innerJoin(members, eq(members.id, payments.memberId))
    .where(payWhere)
    .orderBy(desc(payments.receiptNo))
    .limit(40)

  const txns =
    q && receiptNo === null
      ? await db
          .select()
          .from(transactions)
          .where(or(ilike(transactions.description, `%${q}%`)))
          .orderBy(desc(transactions.id))
          .limit(20)
      : q
        ? []
        : await db.select().from(transactions).orderBy(desc(transactions.id)).limit(20)

  return (
    <div className="space-y-5">
      <PageTitle>ভুল এন্ট্রি বাতিল</PageTitle>
      <form className="relative" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="রসিদ নং (R-0012) বা নাম" className="pl-10" />
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-navy">চাঁদা জমা</h2>
        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {pays.map(({ p, name }) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-base">
                  <span className="font-mono font-semibold">{receiptLabel(p.receiptNo)}</span> · {name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {monthLabel(p.forMonth)} · {taka(p.amount)} · {METHOD_LABELS[p.method]} · {formatDate(p.paidOn)}
                </p>
                {p.status === "void" ? <p className="text-sm text-destructive">বাতিল — {p.voidReason}</p> : null}
              </div>
              {p.status === "valid" ? (
                <VoidButton kind="payment" id={p.id} label={`${receiptLabel(p.receiptNo)} (${name}, ${taka(p.amount)})`} />
              ) : null}
            </li>
          ))}
          {pays.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">কিছু পাওয়া যায়নি</li> : null}
        </ul>
      </section>

      {txns.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-navy">আয়-ব্যয় ও বিনিয়োগ</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {txns.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base">
                    {TXN_TYPE_LABELS[t.type]} · {taka(t.amount)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatDate(t.date)} · {t.description}
                  </p>
                  {t.status === "void" ? <p className="text-sm text-destructive">বাতিল — {t.voidReason}</p> : null}
                </div>
                {t.status === "valid" ? (
                  <VoidButton kind="transaction" id={t.id} label={`${TXN_TYPE_LABELS[t.type]} ${taka(t.amount)}`} />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
