import { redirect } from "next/navigation"
import { AppHeader } from "@/components/layout/app-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { MemberViewBanner } from "@/components/layout/view-toggle"
import { getCurrentMember } from "@/lib/auth/session"
import { viewMode } from "@/lib/auth/view"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Each page also calls requireMember()/requireAdmin(); this only drives the chrome.
  const me = await getCurrentMember()
  if (!me) redirect("/login")
  const view = await viewMode(me)
  const isAdmin = me.role === "admin"
  return (
    <>
      <AppHeader name={me.nameBn} view={isAdmin && !me.mustChangePin ? view : undefined} />
      {isAdmin && view === "member" ? <MemberViewBanner /> : null}
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">{children}</main>
      {me.mustChangePin ? null : <BottomNav isAdmin={view === "admin"} />}
    </>
  )
}
