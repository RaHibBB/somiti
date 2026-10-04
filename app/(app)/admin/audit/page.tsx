import Link from "next/link"
import { count, desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { auditLog, members } from "@/lib/db/schema"
import { formatDateTime, toBn } from "@/lib/format"

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  member_create: "নতুন সদস্য",
  member_update: "সদস্যের তথ্য পরিবর্তন",
  member_cancel: "সদস্যপদ বাতিল",
  shares_set: "শেয়ার নির্ধারণ",
  pin_reset: "পাসওয়ার্ড রিসেট (অ্যাডমিন)",
  pin_change: "নিজের পাসওয়ার্ড পরিবর্তন",
  login_locked: "ভুল পাসওয়ার্ডে অ্যাকাউন্ট বন্ধ",
  email_change: "ইমেইল পরিবর্তন",
  password_reset_requested: "পাসওয়ার্ড রিসেট লিংক চাওয়া",
  password_reset_done: "ইমেইল লিংকে পাসওয়ার্ড রিসেট",
  payment_create: "চাঁদা জমা",
  payment_void: "জমা বাতিল",
  transaction_create: "আয়/ব্যয় যোগ",
  transaction_void: "আয়/ব্যয় বাতিল",
  import: "শিট থেকে ইমপোর্ট",
  proposal_create: "নতুন প্রস্তাব",
  proposal_close: "ভোট বন্ধ ও ফলাফল",
  vote_cast: "ভোট দেওয়া",
  notice_create: "নতুন নোটিশ",
  notice_archive: "নোটিশ সরানো",
  notice_restore: "নোটিশ ফেরানো",
  profit_distribution_create: "মুনাফা বণ্টন সংরক্ষণ",
  profit_distribution_void: "মুনাফা বণ্টন বাতিল",
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin()
  const p = Number((await searchParams).page)
  const page = Number.isInteger(p) && p > 0 ? p : 1
  const db = getDb()
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ a: auditLog, actor: members.nameBn })
      .from(auditLog)
      .leftJoin(members, eq(members.id, auditLog.actorId))
      .orderBy(desc(auditLog.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLog),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <PageTitle>অডিট লগ</PageTitle>
      <p className="text-sm text-muted-foreground">প্রতিটি পরিবর্তনের স্থায়ী রেকর্ড। এখান থেকে কিছু মোছা বা বদলানো যায় না।</p>
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {rows.map(({ a, actor }) => (
          <li key={a.id} className="px-3 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-medium">{ACTION_LABELS[a.action] ?? a.action}</p>
              <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {actor ?? "সিস্টেম"} · {a.tableName} #{toBn(a.rowId ?? "")}
            </p>
            {a.before || a.after ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-sm text-brand-navy">বিস্তারিত</summary>
                <div className="mt-1 grid gap-2 text-xs">
                  {a.before ? (
                    <pre className="overflow-x-auto rounded bg-muted p-2">আগে: {JSON.stringify(a.before, null, 1)}</pre>
                  ) : null}
                  {a.after ? (
                    <pre className="overflow-x-auto rounded bg-muted p-2">পরে: {JSON.stringify(a.after, null, 1)}</pre>
                  ) : null}
                </div>
              </details>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">এখনো কিছু নেই</li> : null}
      </ul>
      <nav className="flex items-center justify-between">
        {page > 1 ? (
          <Link href={`/admin/audit?page=${page - 1}`} className="flex h-11 items-center rounded-lg border bg-white px-4">
            ← আগের
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted-foreground">
          পৃষ্ঠা {toBn(page)} / {toBn(pages)}
        </span>
        {page < pages ? (
          <Link href={`/admin/audit?page=${page + 1}`} className="flex h-11 items-center rounded-lg border bg-white px-4">
            পরের →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
