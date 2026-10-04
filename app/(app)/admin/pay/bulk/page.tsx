import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { monthOf } from "@/lib/ledger"
import { BulkPayForm, type BulkMember } from "./bulk-form"

export const metadata = { title: "একসাথে জমা — সমিতি" }

export default async function BulkPayPage({ searchParams }: PageProps<"/admin/pay/bulk">) {
  await requireAdmin()
  const snap = await getSnapshot()
  const months = snap.members[0]?.lines.map((l) => l.month) ?? []
  const requested = (await searchParams).month
  const thisMonth = monthOf(snap.today)
  const month = typeof requested === "string" && months.includes(`${requested}-01`) ? `${requested}-01` : thisMonth
  const members: BulkMember[] = snap.members
    .filter((m) => m.member.status === "active")
    .map((m) => {
      const line = m.lines.find((l) => l.month === month)
      return {
        id: m.member.id,
        no: m.member.memberNo,
        name: m.member.nameBn,
        remaining: line?.remaining ?? 0,
        expected: line?.expected ?? 0,
      }
    })
  // Offer months from the start up to two months ahead.
  const idx = months.indexOf(thisMonth)
  const selectable = idx < 0 ? months : months.slice(0, idx + 3)
  return (
    <>
      <PageTitle>একসাথে জমা</PageTitle>
      <BulkPayForm key={month} month={month} months={selectable} members={members} today={snap.today} />
    </>
  )
}
