import Link from "next/link"
import { ChevronRight, Send, UserPlus } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { taka, toBn } from "@/lib/format"

export default async function AdminMembersPage() {
  await requireAdmin()
  const snap = await getSnapshot()
  const cancelled = snap.members.filter((x) => x.member.status === "cancelled")
  return (
    <>
      <PageTitle
        action={
          <Link href="/admin/members/new" className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-base text-white">
            <UserPlus className="size-5" /> নতুন
          </Link>
        }
      >
        সদস্য ব্যবস্থাপনা
      </PageTitle>
      <Link
        href="/admin/invite"
        className="mb-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white"
      >
        <Send className="size-5" /> সবাইকে লগইন তথ্য WhatsApp-এ পাঠান
      </Link>
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {snap.members.filter((x) => x.member.status === "active").map(({ member: m, sharesNow, due }) => (
          <li key={m.id}>
            <Link href={`/admin/members/${m.id}`} className="flex min-h-16 items-center gap-3 px-3 py-2 active:bg-muted">
              <span className="w-10 shrink-0 rounded-md bg-secondary py-1 text-center text-sm font-semibold text-brand-navy">
                {toBn(m.memberNo)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">
                  {m.nameBn}
                  {m.role === "admin" ? <span className="ml-1 text-xs text-brand-green">● অ্যাডমিন</span> : null}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {m.status === "cancelled" ? (
                    <span className="text-destructive">বাতিল</span>
                  ) : (
                    <>
                      {toBn(sharesNow)} শেয়ার · {m.phone ? toBn(m.phone) : "মোবাইল নেই"}
                    </>
                  )}
                </span>
              </span>
              {due > 0 ? <span className="text-sm font-semibold text-destructive">{taka(due)}</span> : null}
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {cancelled.length > 0 ? (
        <details className="mt-4 rounded-xl border bg-white">
          <summary className="cursor-pointer px-3 py-3 text-base text-muted-foreground">বাতিল সদস্য ({toBn(cancelled.length)})</summary>
          <ul className="divide-y border-t">
            {cancelled.map(({ member: m }) => (
              <li key={m.id}>
                <Link href={`/admin/members/${m.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2 text-muted-foreground active:bg-muted">
                  <span className="w-10 shrink-0 text-center text-sm">{toBn(m.memberNo)}</span>
                  <span className="min-w-0 flex-1 truncate text-base">{m.nameBn}</span>
                  <ChevronRight className="size-5" />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}
