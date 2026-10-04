import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { PayForm, type PayMember } from "./pay-form"

export const metadata = { title: "জমা নিন — সমিতি" }

export default async function TakePaymentPage({ searchParams }: PageProps<"/admin/pay">) {
  await requireAdmin()
  const snap = await getSnapshot()
  const { member: pre } = await searchParams
  const list: PayMember[] = snap.members
    .filter((m) => m.member.status === "active")
    .map((m) => ({
      id: m.member.id,
      no: m.member.memberNo,
      name: m.member.nameBn,
      phone: m.member.phone,
      shares: m.sharesNow,
      due: m.due,
      // Every month with something left to pay (overdue first, then this and future months).
      open: m.lines.filter((l) => l.remaining > 0).map((l) => ({ month: l.month, remaining: l.remaining, isDue: l.isDue })),
    }))
  const preselect = typeof pre === "string" ? Number(pre) : undefined
  return (
    <>
      <PageTitle>জমা নিন</PageTitle>
      <PayForm members={list} today={snap.today} preselectId={preselect} />
    </>
  )
}
