import Link from "next/link"
import { ArrowLeftRight, ChevronRight, LogIn, LogOut } from "lucide-react"
import { ADMIN_NAV, MAIN_NAV, MY_NAV, PERSONAL_HREFS, REPORT_NAV, type NavItem } from "@/components/layout/nav-items"
import { PageTitle } from "@/components/layout/page-title"
import { logoutAction } from "@/lib/auth/actions"
import { getViewer } from "@/lib/auth/session"
import { setViewAction } from "@/lib/auth/view-actions"
import { showAdminUi } from "@/lib/auth/view"

type Item = NavItem

// Phone menu: the bottom bar has the first five; everything else lives here.
const MEMBER_LINKS: Item[] = [
  ...MY_NAV.filter((i) => i.href !== "/settings/pin"),
  ...MAIN_NAV.filter((i) => ["/proposals", "/notices", "/profit", "/transactions", "/rules"].includes(i.href)),
  ...REPORT_NAV,
  ...MY_NAV.filter((i) => i.href === "/settings/pin"),
]

const PERSONAL = PERSONAL_HREFS

const ADMIN_LINKS: Item[] = ADMIN_NAV

function LinkList({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-white">
      {items.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-base active:bg-muted">
            <Icon className="size-5 text-brand-navy" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function MorePage() {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  return (
    <div className="space-y-6">
      <PageTitle>আরও</PageTitle>
      {me?.role === "admin" ? (
        // Admins can look at the app exactly as a member sees it, then switch back.
        <form action={setViewAction}>
          <input type="hidden" name="mode" value={adminUi ? "member" : "admin"} />
          <button
            type="submit"
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-brand-navy bg-white px-4 text-left text-base active:bg-muted"
          >
            <ArrowLeftRight className="size-5 text-brand-navy" />
            <span className="flex-1">
              {adminUi ? "সদস্য ভিউতে দেখুন" : "অ্যাডমিন ভিউতে ফিরুন"}
              <span className="block text-sm text-muted-foreground">
                {adminUi ? "সদস্যরা যেমন দেখেন — নিজের হিসাবসহ" : "জমা নেওয়া ও অন্যান্য অ্যাডমিন কাজ"}
              </span>
            </span>
          </button>
        </form>
      ) : null}
      {/* Visitors: everything readable; personal pages need login. */}
      <LinkList items={me ? MEMBER_LINKS : MEMBER_LINKS.filter((l) => !PERSONAL.has(l.href))} />
      {adminUi ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-muted-foreground">অ্যাডমিন</h2>
          <LinkList items={ADMIN_LINKS} />
        </section>
      ) : null}
      {me ? (
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border bg-white text-base text-destructive active:bg-muted"
          >
            <LogOut className="size-5" /> লগআউট
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white"
        >
          <LogIn className="size-5" /> লগইন (জমা জানাতে, ভোট দিতে বা অ্যাডমিনের কাজে)
        </Link>
      )}
    </div>
  )
}
