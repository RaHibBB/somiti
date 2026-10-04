import { desc, eq } from "drizzle-orm"
import { MessageCircle } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { appUrl } from "@/lib/app-url"
import { noticeMessage, waLink } from "@/lib/whatsapp"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { members, notices } from "@/lib/db/schema"
import { formatDate } from "@/lib/format"
import { NewNoticeForm, NoticeStatusButton } from "./notice-forms"

export default async function AdminNoticesPage() {
  await requireAdmin()
  const base = await appUrl()
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
            {n.status === "active" ? (
              <a
                href={waLink(null, noticeMessage({ title: n.title, body: n.body, url: `${base}/notices` }))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white active:opacity-90"
              >
                <MessageCircle className="size-5" /> WhatsApp গ্রুপে পাঠান
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
