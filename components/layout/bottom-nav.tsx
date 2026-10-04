"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, User, Users, Grid3x3, Menu, HandCoins, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const MEMBER_ITEMS: Item[] = [
  { href: "/", label: "হোম", icon: Home },
  { href: "/me", label: "আমার হিসাব", icon: User },
  { href: "/members", label: "সদস্য", icon: Users },
  { href: "/grid", label: "গ্রিড", icon: Grid3x3 },
  { href: "/more", label: "আরও", icon: Menu },
]

// Admins get "জমা নিন" (take payment) in the second slot — it's the most-used admin screen.
const ADMIN_ITEMS: Item[] = [
  MEMBER_ITEMS[0],
  { href: "/admin/pay", label: "জমা নিন", icon: HandCoins },
  MEMBER_ITEMS[2],
  MEMBER_ITEMS[3],
  MEMBER_ITEMS[4],
]

// Visitors (not logged in) can read everything; no personal "my account" tab.
const GUEST_ITEMS: Item[] = [
  MEMBER_ITEMS[0],
  MEMBER_ITEMS[2],
  MEMBER_ITEMS[3],
  { href: "/transactions", label: "আয়-ব্যয়", icon: Receipt },
  MEMBER_ITEMS[4],
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function BottomNav({ mode }: { mode: "admin" | "member" | "guest" }) {
  const pathname = usePathname()
  const items = mode === "admin" ? ADMIN_ITEMS : mode === "guest" ? GUEST_ITEMS : MEMBER_ITEMS
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden"
      aria-label="প্রধান মেনু"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs",
                  active ? "text-brand-navy font-semibold" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("size-6", active && "stroke-[2.5]")} />
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
