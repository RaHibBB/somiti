import { redirect } from "next/navigation"
import { AppHeader } from "@/components/layout/app-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { getCurrentMember } from "@/lib/auth/session"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Each page also calls requireMember()/requireAdmin(); this only drives the chrome.
  const me = await getCurrentMember()
  if (!me) redirect("/login")
  return (
    <>
      <AppHeader name={me.nameBn} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-28">{children}</main>
      {me.mustChangePin ? null : <BottomNav isAdmin={me.role === "admin"} />}
    </>
  )
}
