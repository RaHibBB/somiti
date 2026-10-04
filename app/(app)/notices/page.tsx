import { desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { getViewer } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { notices } from "@/lib/db/schema"
import { formatDate } from "@/lib/format"

export const metadata = { title: "নোটিশ — সমিতি" }

export default async function NoticesPage() {
  await getViewer()
  const rows = await getDb().select().from(notices).where(eq(notices.status, "active")).orderBy(desc(notices.createdAt))
  return (
    <div className="space-y-3">
      <PageTitle>নোটিশ</PageTitle>
      {rows.map((n) => (
        <article key={n.id} className="rounded-xl border-l-4 border-brand-green bg-white p-4">
          <p className="text-lg font-semibold">{n.title}</p>
          <p className="mt-1 text-base whitespace-pre-line">{n.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
        </article>
      ))}
      {rows.length === 0 ? <p className="rounded-xl border bg-white p-4 text-center text-muted-foreground">কোনো নোটিশ নেই</p> : null}
    </div>
  )
}
