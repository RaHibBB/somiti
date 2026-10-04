import { notFound } from "next/navigation"
import { STATUS_LABEL } from "@/components/member-statement"
import { PrintDoc } from "@/components/print/print-doc"
import { getViewer } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"

export const metadata = { title: "সদস্য বিবরণী — সমিতি" }

export default async function PrintMemberPage({ params }: PageProps<"/print/member/[id]">) {
  const me = await getViewer()
  const id = Number((await params).id)
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.member.id === id)
  if (!entry) notFound()
  const m = entry.member
  const dueLines = entry.lines.filter((l) => l.isDue || l.paid > 0)
  const pays = [...entry.payments].sort((a, b) => a.receiptNo - b.receiptNo)

  return (
    <PrintDoc title="সদস্য হিসাব বিবরণী" subtitle={`${toBn(m.memberNo)}. ${m.nameBn}${m.phone && (me?.role === "admin" || me?.id === m.id) ? ` · ${toBn(m.phone)}` : ""}`}>
      <table className="mb-4">
        <tbody>
          <tr>
            <th>বর্তমান শেয়ার</th>
            <td>
              {toBn(entry.sharesNow)} টি (মাসে {taka(entry.sharesNow * snap.settings.sharePrice)})
            </td>
            <th>যোগদান</th>
            <td>{formatDate(m.joinedOn)}</td>
          </tr>
          <tr>
            <th>এ পর্যন্ত দেয়</th>
            <td>{taka(entry.expected)}</td>
            <th>মোট জমা</th>
            <td>{taka(entry.paid)}</td>
          </tr>
          <tr>
            <th>বকেয়া</th>
            <td colSpan={3} className={entry.due > 0 ? "font-bold text-red-700" : "font-bold"}>
              {taka(entry.due)}
            </td>
          </tr>
          {m.nomineeName ? (
            <tr>
              <th>নমিনি</th>
              <td colSpan={3}>
                {m.nomineeName}
                {m.nomineePhone && (me?.role === "admin" || me?.id === m.id) ? ` (${toBn(m.nomineePhone)})` : ""}
              </td>
            </tr>
          ) : null}
          {m.status === "cancelled" ? (
            <tr>
              <th>অবস্থা</th>
              <td colSpan={3} className="text-red-700">
                সদস্যপদ বাতিল{m.cancelReason ? ` — ${m.cancelReason}` : ""}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2 className="mb-1 text-[12pt] font-semibold">মাসভিত্তিক হিসাব</h2>
      <table className="mb-4">
        <thead>
          <tr>
            <th>মাস</th>
            <th className="num">দেয়</th>
            <th className="num">জমা</th>
            <th className="num">বাকি</th>
            <th>অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          {dueLines.map((l) => (
            <tr key={l.month}>
              <td>{monthLabel(l.month)}</td>
              <td className="num">{taka(l.expected)}</td>
              <td className="num">{taka(l.paid)}</td>
              <td className="num">{taka(l.remaining)}</td>
              <td>{STATUS_LABEL[l.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-1 text-[12pt] font-semibold">সব জমা</h2>
      <table>
        <thead>
          <tr>
            <th>রসিদ</th>
            <th>তারিখ</th>
            <th>মাস</th>
            <th>মাধ্যম</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {pays.map((p) => (
            <PaymentRow key={p.id} p={p} />
          ))}
          {pays.length === 0 ? (
            <tr>
              <td colSpan={5}>কোনো জমা নেই</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </PrintDoc>
  )
}

function PaymentRow({ p }: { p: (Awaited<ReturnType<typeof getSnapshot>>["members"][number]["payments"])[number] }) {
  const isVoid = p.status === "void"
  return (
    <>
      <tr className={isVoid ? "void" : undefined}>
        <td>{receiptLabel(p.receiptNo)}</td>
        <td>{formatDate(p.paidOn)}</td>
        <td>{monthLabel(p.forMonth)}</td>
        <td>
          {METHOD_LABELS[p.method]}
          {p.trxId ? ` (${p.trxId})` : ""}
        </td>
        <td className="num">{taka(p.amount)}</td>
      </tr>
      {isVoid ? (
        <tr className="void">
          <td colSpan={5} className="void-note">
            ↑ বাতিল — {p.voidReason}
          </td>
        </tr>
      ) : null}
    </>
  )
}
