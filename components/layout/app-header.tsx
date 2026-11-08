import Link from "@/components/link"
import { Bell, LogIn } from "lucide-react"
import { Logo } from "@/components/logo"
import { toBn } from "@/lib/format"
import type { ViewMode } from "@/lib/auth/view"
import { ViewToggleChip } from "./view-toggle"

export function AppHeader({
  name,
  role,
  view,
  guest,
  unread = 0,
}: {
  name?: string
  role?: "admin" | "member"
  view?: ViewMode
  guest?: boolean
  /** Unread notifications for the logged-in member (bell badge). */
  unread?: number
}) {
  return (
    <header className="sticky top-0 z-30 bg-brand-header text-white print:hidden lg:border-b lg:bg-white/90 lg:text-foreground lg:backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3 lg:max-w-6xl lg:px-8 lg:py-2.5">
        {/* Phone: brand + name. Laptop: the sidebar carries the brand, so show who is logged in. */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <Logo size={34} className="shrink-0 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</span>
            <span className="block truncate text-xs text-white/70">{name ? name : "মীরসরাই, চট্টগ্রাম"}</span>
          </span>
        </Link>
        <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
          {name ? (
            <>
              <b className="text-foreground">{name}</b>
              {role === "admin" ? " · অ্যাডমিন" : " · সদস্য"}
            </>
          ) : (
            "সমিতির সব হিসাব সবার জন্য খোলা"
          )}
        </p>
        {/* Admins get an admin ⇄ member view switch; visitors get a login button. */}
        <div className="flex shrink-0 items-center gap-2">
          {!guest && name ? (
            <Link
              href="/notifications"
              aria-label={unread > 0 ? `নোটিফিকেশন, ${toBn(unread)}টি নতুন` : "নোটিফিকেশন"}
              className="relative flex size-10 items-center justify-center rounded-full bg-white/10 lg:bg-secondary"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
                  {unread > 9 ? "৯+" : toBn(unread)}
                </span>
              ) : null}
            </Link>
          ) : null}
          {view ? <ViewToggleChip mode={view} /> : null}
        </div>
        {guest ? (
          <Link
            href="/login"
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-brand-navy lg:bg-primary lg:text-white"
          >
            <LogIn className="size-4" /> লগইন
          </Link>
        ) : null}
      </div>
    </header>
  )
}
