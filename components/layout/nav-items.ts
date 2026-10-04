// The app's menu, in one place: used by the phone "আরও" page and the laptop sidebar.
import {
  Ban,
  BookOpen,
  ClipboardList,
  Download,
  FileClock,
  FilePlus,
  FileText,
  Grid3x3,
  HandCoins,
  Home,
  KeyRound,
  Megaphone,
  PiggyBank,
  Receipt,
  Send,
  ShieldAlert,
  Smartphone,
  User,
  UserCog,
  Users,
  Vote,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  /** Shorter label for the laptop sidebar. */
  short?: string
  icon: React.ComponentType<{ className?: string }>
}

/** Pages that act as a specific person (need login). */
export const PERSONAL_HREFS = new Set(["/me", "/report", "/settings/pin"])

/** Everyone, including visitors. */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "হোম", icon: Home },
  { href: "/members", label: "সদস্য", icon: Users },
  { href: "/grid", label: "মাসিক গ্রিড", icon: Grid3x3 },
  { href: "/transactions", label: "আয়-ব্যয় ও বিনিয়োগ", short: "আয়-ব্যয়", icon: Receipt },
  { href: "/proposals", label: "প্রস্তাব ও ভোট", icon: Vote },
  { href: "/profit", label: "বার্ষিক মুনাফা বণ্টন", short: "মুনাফা বণ্টন", icon: PiggyBank },
  { href: "/notices", label: "নোটিশ", icon: Megaphone },
  { href: "/rules", label: "সমিতির নিয়মাবলি", icon: BookOpen },
]

/** Reports for printing / saving as PDF. */
export const REPORT_NAV: NavItem[] = [
  { href: "/print/month", label: "মাসিক রিপোর্ট (PDF)", icon: FileText },
  { href: "/print/ledger", label: "পূর্ণ জমা খাতা (PDF)", icon: FileText },
]

/** Logged-in members. */
export const MY_NAV: NavItem[] = [
  { href: "/me", label: "আমার হিসাব", icon: User },
  { href: "/report", label: "বিকাশ/নগদে জমা জানান", short: "বিকাশ/নগদে জানান", icon: Smartphone },
  { href: "/settings/pin", label: "পাসওয়ার্ড ও ইমেইল", icon: KeyRound },
]

/** Admins (admin view). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/pay", label: "জমা নিন", icon: HandCoins },
  { href: "/admin/pay/bulk", label: "একসাথে অনেকের জমা (সভার দিন)", short: "একসাথে জমা", icon: Users },
  { href: "/admin/reports", label: "বিকাশ/নগদের জানানো জমা যাচাই", short: "জানানো জমা যাচাই", icon: Smartphone },
  { href: "/admin/dues", label: "বকেয়া ও বাকি", icon: ShieldAlert },
  { href: "/admin/members", label: "সদস্য ব্যবস্থাপনা", icon: UserCog },
  { href: "/admin/invite", label: "লগইন তথ্য WhatsApp-এ পাঠান", short: "লগইন তথ্য পাঠান", icon: Send },
  { href: "/admin/transactions/new", label: "আয়/ব্যয়/বিনিয়োগ যোগ করুন", short: "আয়-ব্যয় যোগ", icon: ClipboardList },
  { href: "/admin/proposals/new", label: "নতুন প্রস্তাব (ভোট)", short: "নতুন প্রস্তাব", icon: FilePlus },
  { href: "/admin/notices", label: "নোটিশ লিখুন", icon: Megaphone },
  { href: "/admin/void", label: "ভুল এন্ট্রি বাতিল", short: "ভুল এন্ট্রি বাতিল", icon: Ban },
  { href: "/admin/audit", label: "অডিট লগ", icon: FileClock },
  { href: "/admin/export", label: "CSV ডাউনলোড", icon: Download },
]
