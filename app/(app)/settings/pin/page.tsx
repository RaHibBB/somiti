import { PageTitle } from "@/components/layout/page-title"
import { logoutAction } from "@/lib/auth/actions"
import { requireMember } from "@/lib/auth/session"
import { EmailForm, PasswordForm } from "./pin-form"
import { NotifyPrefsForm } from "./notify-prefs-form"
import { PushToggle } from "@/components/push-toggle"

export const metadata = { title: "সেটিংস — সমিতি" }

export default async function ChangePasswordPage() {
  const me = await requireMember({ allowPinChange: true })
  return (
    <div className="space-y-6">
      <PageTitle>পাসওয়ার্ড পরিবর্তন</PageTitle>
      <PasswordForm forced={me.mustChangePin} />
      <section className="rounded-xl border bg-white p-4">
        <EmailForm email={me.email} />
      </section>
      {me.mustChangePin ? null : (
        <section id="notifications" className="space-y-4 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-navy">নোটিফিকেশন</h2>
          <PushToggle />
          <NotifyPrefsForm off={me.notifyOff} isAdmin={me.role === "admin"} />
        </section>
      )}
      {me.mustChangePin ? (
        // The bottom nav is hidden until the password is changed, so offer a way out here.
        <form action={logoutAction} className="text-center">
          <button type="submit" className="min-h-11 px-4 text-base text-muted-foreground underline">
            লগআউট
          </button>
        </form>
      ) : null}
    </div>
  )
}
