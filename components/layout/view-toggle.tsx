import { ArrowLeftRight, Eye, ShieldCheck } from "lucide-react"
import { setViewAction } from "@/lib/auth/view-actions"
import type { ViewMode } from "@/lib/auth/view"

/** Header chip for admins: shows the current view and switches to the other one. */
export function ViewToggleChip({ mode }: { mode: ViewMode }) {
  const next = mode === "admin" ? "member" : "admin"
  return (
    <form action={setViewAction}>
      <input type="hidden" name="mode" value={next} />
      <button
        type="submit"
        className="flex h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-sm whitespace-nowrap text-white active:bg-white/25 lg:bg-secondary lg:text-brand-navy lg:hover:bg-muted"
        aria-label={mode === "admin" ? "সদস্য ভিউতে যান" : "অ্যাডমিন ভিউতে যান"}
      >
        {mode === "admin" ? <ShieldCheck className="size-4" /> : <Eye className="size-4" />}
        {mode === "admin" ? "অ্যাডমিন" : "সদস্য"}
        <ArrowLeftRight className="size-3.5 opacity-80" />
      </button>
    </form>
  )
}

/** Thin bar shown in member view so an admin always knows how to get back. */
export function MemberViewBanner() {
  return (
    <form action={setViewAction} className="bg-amber-100 text-amber-950 print:hidden">
      <input type="hidden" name="mode" value="admin" />
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2 text-sm lg:max-w-6xl lg:px-8">
        <span>আপনি সদস্য ভিউতে আছেন — সদস্যরা যেমন দেখেন।</span>
        <button type="submit" className="shrink-0 rounded-full bg-amber-950 px-3 py-1.5 font-semibold text-amber-50">
          অ্যাডমিন ভিউ
        </button>
      </div>
    </form>
  )
}
