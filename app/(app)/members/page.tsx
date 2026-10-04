import { PageTitle } from "@/components/layout/page-title"
import { requireMember } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { MembersList, type MemberRow } from "./members-list"

export const metadata = { title: "সদস্য — সমিতি" }

export default async function MembersPage() {
  const me = await requireMember()
  const snap = await getSnapshot()
  const rows: MemberRow[] = snap.members.map((m) => ({
    id: m.member.id,
    no: m.member.memberNo,
    name: m.member.nameBn,
    shares: m.sharesNow,
    paid: m.paid,
    due: m.due,
    cancelled: m.member.status === "cancelled",
  }))
  const active = rows.filter((r) => !r.cancelled)
  return (
    <>
      <PageTitle>সব সদস্য</PageTitle>
      <MembersList rows={rows} activeCount={active.length} isAdmin={me.role === "admin"} />
    </>
  )
}
