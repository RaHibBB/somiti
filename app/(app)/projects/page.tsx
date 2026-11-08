import Link from "@/components/link"
import { ChevronRight, Plus } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { loadProjects } from "@/lib/data"
import { formatDate, taka, toBn } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata = { title: "প্রকল্প — সমিতি" }

/** Every project (cow, business…) with what went in, what came out, and the result. Open to everyone. */
export default async function ProjectsPage() {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const list = await loadProjects()
  const open = list.filter((p) => !p.closed)
  const tied = open.reduce((s, p) => s + p.totals.tied, 0)
  const closedResult = list.filter((p) => p.closed).reduce((s, p) => s + p.totals.result, 0)

  return (
    <div className="space-y-4">
      <PageTitle
        action={
          adminUi ? (
            <Link href="/admin/projects/new" className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-base text-white">
              <Plus className="size-5" /> নতুন প্রকল্প
            </Link>
          ) : null
        }
      >
        প্রকল্প
      </PageTitle>
      <p className="text-sm text-muted-foreground">
        প্রতিটি প্রকল্পের (যেমন গরু) কেনা, খরচ আর আয় আলাদা হিসাবে থাকে। প্রকল্প চলাকালীন খরচ হওয়া টাকা &quot;বিনিয়োগ&quot;; প্রকল্প শেষ হলে লাভ-ক্ষতি সেই বছরের মুনাফায় যোগ হয়।
      </p>

      {list.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-white p-3">
            <p className="text-sm text-muted-foreground">চলমান প্রকল্পে আছে ({toBn(open.length)}টি)</p>
            <p className="text-xl font-bold">{taka(tied)}</p>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <p className="text-sm text-muted-foreground">শেষ হওয়া প্রকল্পের মোট</p>
            <p className={cn("text-xl font-bold", closedResult > 0 && "text-green-700", closedResult < 0 && "text-destructive")}>
              {closedResult < 0 ? "ক্ষতি " : "লাভ "}
              {taka(Math.abs(closedResult))}
            </p>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {list.map((p) => {
          const t = p.totals
          return (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block rounded-2xl border bg-white p-4 active:bg-muted">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-brand-navy">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.closed && p.closedOn ? `${formatDate(p.startedOn)} – ${formatDate(p.closedOn)}` : `শুরু ${formatDate(p.startedOn)}`}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-sm", p.closed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>
                    {p.closed ? "শেষ" : "চলছে"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-xs text-muted-foreground">মোট খরচ</dt>
                    <dd className="text-base font-semibold">{taka(t.spent)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">আয়</dt>
                    <dd className="text-base font-semibold">{taka(t.income)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{p.closed ? (t.result < 0 ? "ক্ষতি" : "লাভ") : "এখন পর্যন্ত"}</dt>
                    <dd className={cn("text-base font-bold", p.closed && t.result > 0 && "text-green-700", t.result < 0 && p.closed && "text-destructive")}>
                      {t.result < 0 ? "−" : ""}
                      {taka(Math.abs(t.result))}
                    </dd>
                  </div>
                </dl>
                <p className="mt-1 flex items-center justify-end text-sm text-brand-navy">
                  বিস্তারিত <ChevronRight className="size-4" />
                </p>
              </Link>
            </li>
          )
        })}
        {list.length === 0 ? (
          <li className="rounded-xl border bg-white p-4 text-center text-muted-foreground">
            এখনো কোনো প্রকল্প নেই।{adminUi ? " ওপরের \"নতুন প্রকল্প\" চেপে শুরু করুন।" : ""}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
