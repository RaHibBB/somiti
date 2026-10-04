import Link from "next/link"
import { UserPlus } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { getSnapshot } from "@/lib/data"
import { MembersList, type MemberRow } from "./members-list"

export const metadata = { title: "সদস্য — সমিতি" }

export default async function MembersPage() {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
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
      <PageTitle
        action={
          adminUi ? (
            <Link href="/admin/members/new" className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-base text-white">
              <UserPlus className="size-5" /> নতুন সদস্য
            </Link>
          ) : null
        }
      >
        সব সদস্য
      </PageTitle>
      <MembersList rows={rows} activeCount={active.length} isAdmin={adminUi} />
    </>
  )
}
