import { PrintDoc } from "@/components/print/print-doc"
import { getViewer } from "@/lib/auth/session"
import { loadFund, loadTransactions } from "@/lib/data"
import { formatDate, taka, TXN_TYPE_LABELS } from "@/lib/format"
import type { TxnType } from "@/lib/ledger"

export const metadata = { title: "আয়-ব্যয় ও বিনিয়োগ — সমিতি" }

export default async function PrintTransactionsPage() {
  await getViewer()
  const [rows, fund] = await Promise.all([loadTransactions(), loadFund()])
  const ordered = [...rows].reverse() // oldest first on paper

  return (
    <PrintDoc title="আয়-ব্যয় ও বিনিয়োগের হিসাব">
      <table className="mb-4">
        <tbody>
          <tr>
            <th>মোট চাঁদা জমা</th>
            <td className="num">{taka(fund.totalDues)}</td>
            <th>নগদ তহবিল</th>
            <td className="num">{taka(fund.cash)}</td>
          </tr>
          <tr>
            <th>বর্তমান বিনিয়োগ</th>
            <td className="num">{taka(fund.invested)}</td>
            <th>মোট তহবিল</th>
            <td className="num">{taka(fund.total)}</td>
          </tr>
          {(Object.keys(TXN_TYPE_LABELS) as TxnType[]).map((t, i, all) =>
            i % 2 === 0 ? (
              <tr key={t}>
                <th>{TXN_TYPE_LABELS[t]}</th>
                <td className="num">{taka(fund.byType[t])}</td>
                {all[i + 1] ? (
                  <>
                    <th>{TXN_TYPE_LABELS[all[i + 1]]}</th>
                    <td className="num">{taka(fund.byType[all[i + 1]])}</td>
                  </>
                ) : (
                  <td colSpan={2} />
                )}
              </tr>
            ) : null,
          )}
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>ধরন</th>
            <th>বিবরণ</th>
            <th>অনুমোদন</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((t) => (
            <tr key={t.id} className={t.status === "void" ? "void" : undefined}>
              <td>{formatDate(t.date)}</td>
              <td>{TXN_TYPE_LABELS[t.type]}</td>
              <td>
                {t.description}
                {t.status === "void" ? ` (বাতিল — ${t.voidReason})` : ""}
              </td>
              <td>
                {t.approvedBy ?? ""}
                {t.meetingDate ? ` ${formatDate(t.meetingDate)}` : ""}
              </td>
              <td className="num">{taka(t.amount)}</td>
            </tr>
          ))}
          {ordered.length === 0 ? (
            <tr>
              <td colSpan={5}>কোনো লেনদেন নেই</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </PrintDoc>
  )
}
