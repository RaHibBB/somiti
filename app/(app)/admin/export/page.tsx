import { count, eq } from "drizzle-orm"
import { Download } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { sheetOutbox } from "@/lib/db/schema"
import { toBn } from "@/lib/format"
import { SheetSyncButton } from "./sync-button"
import { EXPORTS } from "./tables"

export default async function ExportPage() {
  await requireAdmin()
  const db = getDb()
  const [[pending], [failed]] = await Promise.all([
    db.select({ n: count() }).from(sheetOutbox).where(eq(sheetOutbox.status, "pending")),
    db.select({ n: count() }).from(sheetOutbox).where(eq(sheetOutbox.status, "failed")),
  ])
  return (
    <div className="space-y-5">
      <PageTitle>CSV ডাউনলোড</PageTitle>
      <p className="text-base text-muted-foreground">
        প্রতিটি ফাইল Excel-এ সরাসরি খোলা যাবে (বাংলা ঠিকভাবে দেখাবে)। পাসওয়ার্ড কোনো ফাইলে থাকে না।
      </p>
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {Object.entries(EXPORTS).map(([name, { label }]) => (
          <li key={name}>
            {/* Plain <a>: a file download, not a client-side navigation. */}
            <a href={`/admin/export/${name}`} download className="flex min-h-14 items-center gap-3 px-4 active:bg-muted">
              <Download className="size-5 text-brand-navy" />
              <span className="flex-1 text-base">{label}</span>
              <span className="font-mono text-xs text-muted-foreground">{name}.csv</span>
            </a>
          </li>
        ))}
      </ul>

      <section className="space-y-2 rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold text-brand-navy">Google Sheet</h2>
        <p className="text-sm text-muted-foreground">
          অপেক্ষমাণ: {toBn(pending.n)} · ব্যর্থ: {toBn(failed.n)}। প্রতিদিন স্বয়ংক্রিয়ভাবে আবার চেষ্টা হয়, রবিবার পুরো শিট নতুন করে লেখা হয়।
        </p>
        <SheetSyncButton />
      </section>
    </div>
  )
}
