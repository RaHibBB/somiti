import { PageTitle } from "@/components/layout/page-title"
import { logoutAction } from "@/lib/auth/actions"
import { requireMember } from "@/lib/auth/session"
import { EmailForm, PasswordForm } from "./pin-form"

export const metadata = { title: "পাসওয়ার্ড ও ইমেইল — সমিতি" }

export default async function ChangePasswordPage() {
  const me = await requireMember({ allowPinChange: true })
  return (
    <div className="space-y-6">
      <PageTitle>পাসওয়ার্ড পরিবর্তন</PageTitle>
      <PasswordForm forced={me.mustChangePin} />
      <section className="rounded-xl border bg-white p-4">
        <EmailForm email={me.email} />
      </section>
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
