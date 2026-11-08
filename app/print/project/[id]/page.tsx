import { notFound } from "next/navigation"
import { PrintDoc } from "@/components/print/print-doc"
import { getViewer } from "@/lib/auth/session"
import { loadProjects } from "@/lib/data"
import { formatDate, taka } from "@/lib/format"
import { categoryBreakdown, KIND_LABELS, TYPE_TO_KIND } from "@/lib/projects"

export async function generateMetadata({ params }: PageProps<"/print/project/[id]">) {
  const id = Number((await params).id)
  const p = (await loadProjects()).find((x) => x.id === id)
  // The browser uses the title as the PDF file name.
  return { title: p ? `প্রকল্প ${p.name}` : "প্রকল্প" }
}

export default async function PrintProjectPage({ params }: PageProps<"/print/project/[id]">) {
  await getViewer()
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const p = (await loadProjects()).find((x) => x.id === id)
  if (!p) notFound()
  const t = p.totals
  const breakdown = categoryBreakdown(p.entries)
  const ordered = [...p.entries].reverse() // oldest first on paper

  return (
    <PrintDoc
      title={`প্রকল্পের হিসাব: ${p.name}`}
      subtitle={p.closed && p.closedOn ? `${formatDate(p.startedOn)} – ${formatDate(p.closedOn)} (শেষ)` : `শুরু ${formatDate(p.startedOn)} (চলছে)`}
    >
      <table className="mb-4">
        <tbody>
          <tr>
            <th>কেনা / মূলধন</th>
            <td className="num">{taka(t.capital)}</td>
            <th>খরচ</th>
            <td className="num">{taka(t.costs)}</td>
          </tr>
          <tr>
            <th>মোট খরচ</th>
            <td className="num">{taka(t.spent)}</td>
            <th>আয় / বিক্রি</th>
            <td className="num">{taka(t.income)}</td>
          </tr>
          <tr>
            <th>{p.closed ? (t.result < 0 ? "ক্ষতি" : "লাভ") : "এখন পর্যন্ত (আয় − খরচ)"}</th>
            <td className="num">
              <b>
                {t.result < 0 ? "−" : ""}
                {taka(Math.abs(t.result))}
              </b>
            </td>
            <th>বাজেট</th>
            <td className="num">{p.budget !== null ? taka(p.budget) : "—"}</td>
          </tr>
        </tbody>
      </table>

      {breakdown.length > 0 ? (
        <table className="mb-4">
          <thead>
            <tr>
              <th>খাত</th>
              <th>ধরন</th>
              <th className="num">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={`${b.kind}-${b.category}`}>
                <td>{b.category}</td>
                <td>{KIND_LABELS[b.kind]}</td>
                <td className="num">{taka(b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>খাত</th>
            <th>বিবরণ</th>
            <th className="num">টাকা</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((e) => {
            const kind = TYPE_TO_KIND[e.type]
            return (
              <tr key={e.id} className={e.status === "void" ? "void" : undefined}>
                <td>{formatDate(e.date)}</td>
                <td>{e.category ?? (kind ? KIND_LABELS[kind] : "")}</td>
                <td>
                  {e.description}
                  {e.status === "void" ? ` (বাতিল — ${e.voidReason})` : ""}
                </td>
                <td className="num">
                  {kind === "income" ? "+" : "−"}
                  {taka(e.amount)}
                </td>
              </tr>
            )
          })}
          {ordered.length === 0 ? (
            <tr>
              <td colSpan={4}>কোনো এন্ট্রি নেই</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </PrintDoc>
  )
}
