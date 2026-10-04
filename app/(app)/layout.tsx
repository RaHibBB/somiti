import { AppHeader } from "@/components/layout/app-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { MainFrame } from "@/components/layout/main-frame"
import { Sidebar } from "@/components/layout/sidebar"
import { MemberViewBanner } from "@/components/layout/view-toggle"
import { getCurrentMember } from "@/lib/auth/session"
import { viewMode } from "@/lib/auth/view"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Reading is public; this only drives the chrome. Pages that need a person check it themselves.
  const me = await getCurrentMember()
  const view = await viewMode(me)
  const isAdmin = me?.role === "admin"
  const mode = !me ? "guest" : view === "admin" ? "admin" : "member"
  // A member who still has to choose a password sees no menu until they have.
  const showNav = !me?.mustChangePin
  return (
    <>
      {showNav ? <Sidebar mode={mode} /> : null}
      <div className={showNav ? "lg:pl-64" : undefined}>
        <AppHeader
          name={me?.nameBn}
          role={isAdmin ? "admin" : me ? "member" : undefined}
          view={isAdmin && !me?.mustChangePin ? view : undefined}
          guest={!me}
        />
        {isAdmin && view === "member" ? <MemberViewBanner /> : null}
        <MainFrame>{children}</MainFrame>
      </div>
      {showNav ? <BottomNav mode={mode} /> : null}
    </>
  )
}
