import Link from "@/components/link"
import { after } from "next/server"
import { and, desc, eq, isNull } from "drizzle-orm"
import { Settings } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { PushToggle } from "@/components/push-toggle"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata = { title: "নোটিফিকেশন — সমিতি" }

/** The member's inbox (latest 50). Opening it marks everything as read. */
export default async function NotificationsPage() {
  const me = await requireMember()
  const db = getDb()
  const rows = await db.select().from(notifications).where(eq(notifications.memberId, me.id)).orderBy(desc(notifications.id)).limit(50)
  if (rows.some((r) => !r.readAt)) {
    after(() =>
      db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.memberId, me.id), isNull(notifications.readAt))),
    )
  }
  return (
    <div className="space-y-4">
      <PageTitle
        action={
          <Link href="/settings/pin#notifications" className="flex h-10 items-center gap-1 rounded-lg border bg-white px-3 text-sm">
            <Settings className="size-4" /> কোন খবর পাবেন
          </Link>
        }
      >
        নোটিফিকেশন
      </PageTitle>
      <PushToggle variant="prompt" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {rows.map((n) => {
          const unread = !n.readAt
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className={cn("text-base", unread && "font-semibold")}>{n.title}</p>
                {unread ? <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-destructive" aria-label="নতুন" /> : null}
              </div>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </>
          )
          return (
            <li key={n.id} className={cn(unread && "bg-secondary/50")}>
              {n.url ? (
                <Link href={n.url} className="block px-3 py-3 active:bg-muted">
                  {inner}
                </Link>
              ) : (
                <div className="px-3 py-3">{inner}</div>
              )}
            </li>
          )
        })}
        {rows.length === 0 ? <li className="px-3 py-6 text-center text-muted-foreground">এখনো কোনো নোটিফিকেশন নেই</li> : null}
      </ul>
    </div>
  )
}
