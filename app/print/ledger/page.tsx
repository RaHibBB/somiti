import { PrintDoc } from "@/components/print/print-doc"
import { getViewer } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"

export const metadata = { title: "পূর্ণ জমা খাতা — সমিতি" }

export default async function PrintLedgerPage() {
  await getViewer()
  const snap = await getSnapshot()
  const rows = snap.members
    .flatMap((m) => m.payments.map((p) => ({ p, no: m.member.memberNo, name: m.member.nameBn })))
    .sort((a, b) => a.p.receiptNo - b.p.receiptNo)
  const total = rows.reduce((s, r) => (r.p.status === "valid" ? s + r.p.amount : s), 0)
  const voidCount = rows.filter((r) => r.p.status === "void").length

  return (
    <PrintDoc
      title="পূর্ণ জমা খাতা"
      subtitle={`মোট ${toBn(rows.length)}টি এন্ট্রি${voidCount ? ` (বাতিল ${toBn(voidCount)}টি)` : ""} · বৈধ জমা ${taka(total)}`}
    >
      <table>
        <thead>
          <tr>
            <th>রসিদ</th>
            <th>তারিখ</th>
            <th>সদস্য</th>
            <th>কোন মাসের</th>
            <th>মাধ্যম</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, no, name }) => (
            <tr key={p.id} className={p.status === "void" ? "void" : undefined}>
              <td>{receiptLabel(p.receiptNo)}</td>
              <td>{formatDate(p.paidOn)}</td>
              <td>
                {toBn(no)}. {name}
              </td>
              <td>{monthLabel(p.forMonth)}</td>
              <td>{METHOD_LABELS[p.method]}</td>
              <td className="num">
                {taka(p.amount)}
                {p.status === "void" ? " বাতিল" : ""}
              </td>
            </tr>
          ))}
          <tr>
            <th colSpan={5}>মোট (বাতিল বাদে)</th>
            <th className="num">{taka(total)}</th>
          </tr>
        </tbody>
      </table>
    </PrintDoc>
  )
}
