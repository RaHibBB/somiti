"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// On a laptop, lists and dashboards use the full width; forms and reading pages stay in a
// comfortable column so inputs aren't stretched across the screen. (Phones: always one column.)
const WIDE_EXACT = new Set([
  "/",
  "/members",
  "/grid",
  "/transactions",
  "/proposals",
  "/profit",
  "/notices",
  "/me",
  "/admin/dues",
  "/admin/members",
  "/admin/reports",
  "/admin/audit",
  "/admin/export",
  "/admin/void",
  "/admin/notices",
])

export function MainFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const wide = WIDE_EXACT.has(pathname) || /^\/members\/\d+$/.test(pathname)
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-2xl px-4 pt-4 pb-28 lg:px-8 lg:pt-6 lg:pb-12",
        wide ? "lg:max-w-6xl" : "lg:max-w-2xl",
      )}
    >
      {children}
    </main>
  )
}
