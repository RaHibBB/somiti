import { desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { members, notices } from "@/lib/db/schema"
import { formatDate } from "@/lib/format"
import { NewNoticeForm, NoticeStatusButton } from "./notice-forms"

export default async function AdminNoticesPage() {
  await requireAdmin()
  const rows = await getDb()
    .select({ n: notices, by: members.nameBn })
    .from(notices)
    .leftJoin(members, eq(members.id, notices.createdBy))
    .orderBy(desc(notices.createdAt))
  return (
    <div className="space-y-5">
      <PageTitle>নোটিশ</PageTitle>
      <section className="rounded-xl border bg-white p-4">
        <NewNoticeForm />
      </section>
      <ul className="space-y-2">
        {rows.map(({ n, by }) => (
          <li key={n.id} className={n.status === "archived" ? "rounded-xl border bg-muted p-3 opacity-70" : "rounded-xl border bg-white p-3"}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-semibold">{n.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(n.createdAt)} · {by ?? "—"}
                  {n.status === "archived" ? " · সরিয়ে রাখা" : ""}
                </p>
              </div>
              <NoticeStatusButton id={n.id} archived={n.status === "archived"} />
            </div>
            <p className="mt-2 text-base whitespace-pre-line">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
