import Link from "next/link"
import { notFound } from "next/navigation"
import { STATUS_LABEL } from "@/components/member-statement"
import { PrintDoc } from "@/components/print/print-doc"
import { getViewer } from "@/lib/auth/session"
import { getSnapshot, loadTransactions } from "@/lib/data"
import { formatDate, monthLabel, receiptLabel, taka, toBn, TXN_TYPE_LABELS } from "@/lib/format"
import { addMonths } from "@/lib/ledger"

export const metadata = { title: "মাসিক রিপোর্ট — সমিতি" }

export default async function PrintMonthPage({ params }: PageProps<"/print/month/[month]">) {
  await getViewer()
  const raw = (await params).month
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) notFound()
  const month = `${raw}-01`
  const [snap, txns] = await Promise.all([getSnapshot(), loadTransactions()])

  const rows = snap.members
    .map((m) => ({ m, line: m.lines.find((l) => l.month === month) }))
    .filter((r) => r.line && (r.m.member.status === "active" || r.line.paid > 0))
  const totalExpected = rows.reduce((s, r) => s + (r.m.member.status === "active" ? r.line!.expected : 0), 0)
  const totalPaid = rows.reduce((s, r) => s + r.line!.paid, 0)

  // Money actually received during this calendar month (by payment date), any for_month.
  const received = snap.members
    .flatMap((m) => m.payments.map((p) => ({ p, name: m.member.nameBn })))
    .filter(({ p }) => p.paidOn.slice(0, 7) === raw)
    .sort((a, b) => a.p.receiptNo - b.p.receiptNo)
  const receivedTotal = received.reduce((s, r) => (r.p.status === "valid" ? s + r.p.amount : s), 0)
  const monthTxns = txns.filter((t) => t.date.slice(0, 7) === raw).reverse()

  const prev = addMonths(month, -1).slice(0, 7)
  const next = addMonths(month, 1).slice(0, 7)

  return (
    <PrintDoc title={`মাসিক রিপোর্ট — ${monthLabel(month)}`}>
      <div className="no-print mb-3 flex justify-between text-base">
        <Link href={`/print/month/${prev}`} className="text-brand-navy underline">
          ← {monthLabel(`${prev}-01`)}
        </Link>
        <Link href={`/print/month/${next}`} className="text-brand-navy underline">
          {monthLabel(`${next}-01`)} →
        </Link>
      </div>

      <h2 className="mb-1 text-[12pt] font-semibold">এই মাসের চাঁদা</h2>
      <table className="mb-4">
        <thead>
          <tr>
            <th>নং</th>
            <th>সদস্য</th>
            <th className="num">শেয়ার</th>
            <th className="num">দেয়</th>
            <th className="num">জমা</th>
            <th>অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, line }) => (
            <tr key={m.member.id}>
              <td>{toBn(m.member.memberNo)}</td>
              <td>
                {m.member.nameBn}
                {m.member.status === "cancelled" ? " (বাতিল)" : ""}
              </td>
              <td className="num">{toBn(line!.expected / snap.settings.sharePrice)}</td>
              <td className="num">{taka(line!.expected)}</td>
              <td className="num">{taka(line!.paid)}</td>
              <td>{STATUS_LABEL[line!.status]}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={3}>মোট</th>
            <th className="num">{taka(totalExpected)}</th>
            <th className="num">{taka(totalPaid)}</th>
            <th>বাকি {taka(Math.max(0, totalExpected - totalPaid))}</th>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-1 text-[12pt] font-semibold">এই মাসে প্রাপ্ত সব জমা (জমার তারিখ অনুযায়ী)</h2>
      <table className="mb-4">
        <thead>
          <tr>
            <th>রসিদ</th>
            <th>তারিখ</th>
            <th>সদস্য</th>
            <th>কোন মাসের</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {received.map(({ p, name }) => (
            <tr key={p.id} className={p.status === "void" ? "void" : undefined}>
              <td>{receiptLabel(p.receiptNo)}</td>
              <td>{formatDate(p.paidOn)}</td>
              <td>{name}</td>
              <td>{monthLabel(p.forMonth)}</td>
              <td className="num">
                {taka(p.amount)}
                {p.status === "void" ? " (বাতিল)" : ""}
              </td>
            </tr>
          ))}
          <tr>
            <th colSpan={4}>মোট প্রাপ্তি</th>
            <th className="num">{taka(receivedTotal)}</th>
          </tr>
        </tbody>
      </table>

      <h2 className="mb-1 text-[12pt] font-semibold">এই মাসের আয়-ব্যয় ও বিনিয়োগ</h2>
      <table>
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>ধরন</th>
            <th>বিবরণ</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {monthTxns.map((t) => (
            <tr key={t.id} className={t.status === "void" ? "void" : undefined}>
              <td>{formatDate(t.date)}</td>
              <td>{TXN_TYPE_LABELS[t.type]}</td>
              <td>
                {t.description}
                {t.status === "void" ? ` (বাতিল — ${t.voidReason})` : ""}
              </td>
              <td className="num">{taka(t.amount)}</td>
            </tr>
          ))}
          {monthTxns.length === 0 ? (
            <tr>
              <td colSpan={4}>এই মাসে কোনো লেনদেন নেই</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </PrintDoc>
  )
}
