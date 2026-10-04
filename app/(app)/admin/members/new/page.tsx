import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { loadSettings } from "@/lib/data"
import { todayDhaka } from "@/lib/format"
import { nextMemberNo } from "@/lib/services/members"
import { NewMemberForm } from "../member-forms"

export default async function NewMemberPage() {
  await requireAdmin()
  const db = getDb()
  const [no, settings] = await Promise.all([nextMemberNo(db), loadSettings(db)])
  return (
    <>
      <PageTitle>নতুন সদস্য</PageTitle>
      <NewMemberForm
        startMonth={settings.startMonth}
        defaults={{
          memberNo: no,
          nameBn: "",
          phone: null,
          email: null,
          role: "member",
          joinedOn: todayDhaka(),
          nomineeName: null,
          nomineePhone: null,
          notes: null,
        }}
      />
    </>
  )
}
