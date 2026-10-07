import { notFound } from "next/navigation"
import { PrintDoc } from "@/components/print/print-doc"
import { getSnapshot } from "@/lib/data"
import { formatDate, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"

// The browser proposes the page title as the PDF file name: receipt number, member name and month(s).
export async function generateMetadata({ params, searchParams }: PageProps<"/print/receipt/[no]">) {
  const no = Number((await params).no)
  const nos = parseNos(no, (await searchParams).with)
  const entry = (await getSnapshot()).members.find((x) => x.payments.some((p) => p.receiptNo === no))
  if (!entry) return { title: "টাকা জমার রসিদ" }
  const pays = entry.payments.filter((p) => nos.includes(p.receiptNo)).sort((a, b) => a.receiptNo - b.receiptNo)
  const months = pays.map((p) => monthLabel(p.forMonth)).join(", ")
  return { title: `রসিদ ${receiptLabel(no)} - ${entry.member.nameBn} - ${months}` }
}

function parseNos(no: number, rawWith: string | string[] | undefined): number[] {
  const extra = String(rawWith ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
  return [...new Set([no, ...extra])].slice(0, 12)
}

/** Money receipt for one payment (or several, for a multi-month payment: /print/receipt/18?with=19,20). */
export default async function PrintReceiptPage({ params, searchParams }: PageProps<"/print/receipt/[no]">) {
  const no = Number((await params).no)
  const nos = parseNos(no, (await searchParams).with)
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.payments.some((p) => p.receiptNo === no))
  if (!entry) notFound()
  // Only this member's receipts, so a hand-edited link can't mix people on one receipt.
  const pays = entry.payments.filter((p) => nos.includes(p.receiptNo)).sort((a, b) => a.receiptNo - b.receiptNo)
  const m = entry.member
  const valid = pays.filter((p) => p.status === "valid")
  const voided = pays.filter((p) => p.status === "void")
  const total = valid.reduce((s, p) => s + p.amount, 0)
  const first = pays[0]
  const receiver = first.receivedBy ? snap.members.find((x) => x.member.id === first.receivedBy)?.member : null

  return (
    <PrintDoc
      title="টাকা জমার রসিদ"
      subtitle={`রসিদ নং ${pays.map((p) => receiptLabel(p.receiptNo)).join(", ")}`}
      stamp={valid.length === 0 ? "বাতিল" : undefined}
    >
      <table className="mb-4">
        <tbody>
          <tr>
            <th style={{ width: "28%" }}>সদস্যের নাম</th>
            <td className="text-[12pt] font-bold">{m.nameBn}</td>
            <th style={{ width: "18%" }}>সদস্য নং</th>
            <td>{toBn(m.memberNo)}</td>
          </tr>
          <tr>
            <th>জমার তারিখ</th>
            <td>{formatDate(first.paidOn)}</td>
            <th>মাধ্যম</th>
            <td>
              {METHOD_LABELS[first.method]}
              {first.trxId ? ` (${first.trxId})` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mb-3">
        <thead>
          <tr>
            <th>রসিদ</th>
            <th>কোন মাসের চাঁদা</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {pays.map((p) => (
            <tr key={p.id} className={p.status === "void" ? "void" : undefined}>
              <td>{receiptLabel(p.receiptNo)}</td>
              <td>{monthLabel(p.forMonth)}</td>
              <td className="num">{taka(p.amount)}</td>
            </tr>
          ))}
          <tr>
            <th colSpan={2} className="num">
              মোট জমা
            </th>
            <td className="num text-[12pt] font-bold">{taka(total)}</td>
          </tr>
        </tbody>
      </table>
      {voided.length > 0 ? (
        <p className="mb-3 text-[10pt] text-red-700">
          বাতিল রসিদ: {voided.map((p) => `${receiptLabel(p.receiptNo)} — ${p.voidReason}`).join("; ")}
        </p>
      ) : null}
      {receiver ? (
        <p className="text-[10pt]">
          টাকা গ্রহণ করেছেন: <b>{receiver.nameBn}</b> (অ্যাডমিন)
        </p>
      ) : null}
      <p className="mt-1 text-[10pt]">
        সদস্যের বর্তমান বকেয়া: <b>{taka(entry.due)}</b>
      </p>
    </PrintDoc>
  )
}
