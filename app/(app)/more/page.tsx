import Link from "next/link"
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Download,
  FileClock,
  HandCoins,
  KeyRound,
  LogOut,
  Receipt,
  ShieldAlert,
  User,
  UserCog,
  Ban,
  FileText,
  Vote,
  Megaphone,
  PiggyBank,
  FilePlus,
} from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { logoutAction } from "@/lib/auth/actions"
import { requireMember } from "@/lib/auth/session"

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

const MEMBER_LINKS: Item[] = [
  { href: "/me", label: "আমার হিসাব", icon: User },
  { href: "/proposals", label: "প্রস্তাব ও ভোট", icon: Vote },
  { href: "/notices", label: "নোটিশ", icon: Megaphone },
  { href: "/profit", label: "বার্ষিক মুনাফা বণ্টন", icon: PiggyBank },
  { href: "/transactions", label: "আয়-ব্যয় ও বিনিয়োগ", icon: Receipt },
  { href: "/rules", label: "সমিতির নিয়মাবলি", icon: BookOpen },
  { href: "/print/month", label: "মাসিক রিপোর্ট (PDF)", icon: FileText },
  { href: "/print/ledger", label: "পূর্ণ জমা খাতা (PDF)", icon: FileText },
  { href: "/settings/pin", label: "পাসওয়ার্ড ও ইমেইল", icon: KeyRound },
]

const ADMIN_LINKS: Item[] = [
  { href: "/admin/pay", label: "জমা নিন", icon: HandCoins },
  { href: "/admin/dues", label: "বকেয়া ও রিমাইন্ডার", icon: ShieldAlert },
  { href: "/admin/members", label: "সদস্য ব্যবস্থাপনা", icon: UserCog },
  { href: "/admin/transactions/new", label: "আয়/ব্যয়/বিনিয়োগ যোগ করুন", icon: ClipboardList },
  { href: "/admin/proposals/new", label: "নতুন প্রস্তাব (ভোট)", icon: FilePlus },
  { href: "/admin/notices", label: "নোটিশ লিখুন", icon: Megaphone },
  { href: "/admin/void", label: "ভুল এন্ট্রি বাতিল", icon: Ban },
  { href: "/admin/audit", label: "অডিট লগ", icon: FileClock },
  { href: "/admin/export", label: "CSV ডাউনলোড", icon: Download },
]

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
  const me = await requireMember()
  return (
    <div className="space-y-6">
      <PageTitle>আরও</PageTitle>
      <LinkList items={MEMBER_LINKS} />
      {me.role === "admin" ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-muted-foreground">অ্যাডমিন</h2>
          <LinkList items={ADMIN_LINKS} />
        </section>
      ) : null}
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border bg-white text-base text-destructive active:bg-muted"
        >
          <LogOut className="size-5" /> লগআউট
        </button>
      </form>
    </div>
  )
}
