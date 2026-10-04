import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { getSnapshot } from "@/lib/data"
import { listInviteCandidates } from "@/lib/services/invites"
import { InviteTool } from "./invite-tool"

export default async function InvitePage() {
  await requireAdmin()
  const [candidates, snap] = await Promise.all([listInviteCandidates(getDb()), getSnapshot()])
  const activeCount = snap.members.filter((m) => m.member.status === "active").length
  return (
    <>
      <PageTitle>লগইন তথ্য পাঠান</PageTitle>
      <InviteTool candidates={candidates} activeCount={activeCount} />
    </>
  )
}
