import { PageTitle } from "@/components/layout/page-title"
import { MemberStatement } from "@/components/member-statement"
import { requireMember } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"

export const metadata = { title: "আমার হিসাব — সমিতি" }

export default async function MyAccountPage() {
  const me = await requireMember()
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.member.id === me.id)!
  return (
    <>
      <PageTitle>আমার হিসাব</PageTitle>
      <MemberStatement entry={entry} sharePrice={snap.settings.sharePrice} />
    </>
  )
}
