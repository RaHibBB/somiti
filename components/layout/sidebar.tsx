"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, LogOut } from "lucide-react"
import { Logo } from "@/components/logo"
import { logoutAction } from "@/lib/auth/actions"
import { cn } from "@/lib/utils"
import { ADMIN_NAV, MAIN_NAV, MY_NAV, REPORT_NAV, type NavItem } from "./nav-items"

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

function Group({ title, items, pathname }: { title?: string; items: NavItem[]; pathname: string }) {
  // The longest matching href wins, so "/admin/pay" isn't also lit up on "/admin/pay/bulk".
  const best = items.filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]
  return (
    <div className="space-y-0.5">
      {title ? <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">{title}</p> : null}
      {items.map(({ href, label, short, icon: Icon }) => {
        const active = best?.href === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-3 rounded-lg px-3 text-[0.92rem] transition-colors",
              active ? "bg-brand-navy font-semibold text-white" : "text-foreground/85 hover:bg-secondary",
            )}
          >
            <Icon className="size-[1.15rem] shrink-0" />
            <span className="truncate">{short ?? label}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** Laptop navigation: always-visible menu on the left (the phone uses the bottom bar instead). */
export function Sidebar({ mode }: { mode: "admin" | "member" | "guest" }) {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-white print:hidden lg:flex">
      <Link href="/" className="flex items-center gap-3 border-b bg-brand-header px-4 py-4 text-white">
        <Logo size={40} className="shrink-0 rounded-lg" />
        <span className="min-w-0">
          <span className="block text-[0.95rem] leading-snug font-bold">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</span>
          <span className="block text-xs text-white/70">মীরসরাই, চট্টগ্রাম</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="প্রধান মেনু">
        <Group items={mode === "admin" ? MAIN_NAV.filter((i) => i.href !== "/grid") : MAIN_NAV} pathname={pathname} />
        {mode === "admin" ? <Group title="অ্যাডমিনের কাজ" items={ADMIN_NAV} pathname={pathname} /> : null}
        <Group title="রিপোর্ট" items={REPORT_NAV} pathname={pathname} />
        {mode !== "guest" ? <Group title="আমার" items={MY_NAV} pathname={pathname} /> : null}
      </nav>

      <div className="border-t p-3">
        {mode === "guest" ? (
          <Link
            href="/login"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white"
          >
            <LogIn className="size-5" /> লগইন
          </Link>
        ) : (
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm text-destructive hover:bg-red-50"
            >
              <LogOut className="size-4" /> লগআউট
            </button>
          </form>
        )}
      </div>
    </aside>
  )
}
