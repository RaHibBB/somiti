import Link from "next/link"
import type { ViewMode } from "@/lib/auth/view"
import { ViewToggleChip } from "./view-toggle"

export function AppHeader({ name, view }: { name?: string; view?: ViewMode }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-header text-white print:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</p>
          <p className="truncate text-xs text-white/70">{name ? name : "মীরসরাই, চট্টগ্রাম"}</p>
        </Link>
        {/* Admins get an admin ⇄ member view switch here. */}
        {view ? <ViewToggleChip mode={view} /> : null}
      </div>
    </header>
  )
}
