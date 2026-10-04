import Link from "next/link"
import { notFound } from "next/navigation"
import { PageTitle } from "@/components/layout/page-title"
import { MemberStatement } from "@/components/member-statement"
import { requireMember } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { toBn } from "@/lib/format"

export default async function MemberAccountPage({ params }: PageProps<"/members/[id]">) {
  const me = await requireMember()
  const id = Number((await params).id)
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.member.id === id)
  if (!entry) notFound()
  const m = entry.member
  return (
    <>
      <PageTitle
        action={
          me.role === "admin" ? (
            <div className="flex gap-2">
              {m.status === "active" ? (
                <Link href={`/admin/pay?member=${m.id}`} className="flex h-10 items-center rounded-lg bg-brand-green px-3 text-sm font-semibold text-white">
                  জমা নিন
                </Link>
              ) : null}
              <Link href={`/admin/members/${m.id}`} className="flex h-10 items-center rounded-lg border bg-white px-3 text-sm">
                সম্পাদনা
              </Link>
            </div>
          ) : null
        }
      >
        {toBn(m.memberNo)}. {m.nameBn}
      </PageTitle>
      {m.status === "cancelled" ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-base text-destructive">এই সদস্যপদ বাতিল করা হয়েছে।</p>
      ) : null}
      <MemberStatement entry={entry} sharePrice={snap.settings.sharePrice} />
    </>
  )
}
