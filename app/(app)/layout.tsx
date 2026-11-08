import { AppHeader } from "@/components/layout/app-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { MainFrame } from "@/components/layout/main-frame"
import { Sidebar } from "@/components/layout/sidebar"
import { MemberViewBanner } from "@/components/layout/view-toggle"
import { getCurrentMember } from "@/lib/auth/session"
import { and, count, eq, isNull } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { notifications } from "@/lib/db/schema"
import { viewMode } from "@/lib/auth/view"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Reading is public; this only drives the chrome. Pages that need a person check it themselves.
  const me = await getCurrentMember()
  const view = await viewMode(me)
  const isAdmin = me?.role === "admin"
  const mode = !me ? "guest" : view === "admin" ? "admin" : "member"
  // A member who still has to choose a password sees no menu until they have.
  const showNav = !me?.mustChangePin
  const [{ n: unread }] = me
    ? await getDb()
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.memberId, me.id), isNull(notifications.readAt)))
    : [{ n: 0 }]
  return (
    <>
      {showNav ? <Sidebar mode={mode} /> : null}
      <div className={showNav ? "lg:pl-64" : undefined}>
        <AppHeader
          name={me?.nameBn}
          role={isAdmin ? "admin" : me ? "member" : undefined}
          view={isAdmin && !me?.mustChangePin ? view : undefined}
          guest={!me}
          unread={unread}
        />
        {isAdmin && view === "member" ? <MemberViewBanner /> : null}
        <MainFrame>{children}</MainFrame>
      </div>
      {showNav ? <BottomNav mode={mode} /> : null}
    </>
  )
}
