import Link from "next/link"
import { LogIn } from "lucide-react"
import { Logo } from "@/components/logo"
import type { ViewMode } from "@/lib/auth/view"
import { ViewToggleChip } from "./view-toggle"

export function AppHeader({ name, view, guest }: { name?: string; view?: ViewMode; guest?: boolean }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-header text-white print:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo size={34} className="shrink-0 rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</span>
            <span className="block truncate text-xs text-white/70">{name ? name : "মীরসরাই, চট্টগ্রাম"}</span>
          </span>
        </Link>
        {/* Admins get an admin ⇄ member view switch; visitors get a login button. */}
        {view ? <ViewToggleChip mode={view} /> : null}
        {guest ? (
          <Link href="/login" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-brand-navy">
            <LogIn className="size-4" /> লগইন
          </Link>
        ) : null}
      </div>
    </header>
  )
}
