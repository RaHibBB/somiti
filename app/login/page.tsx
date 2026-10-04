import { redirect } from "next/navigation"
import { AuthShell } from "@/components/layout/auth-shell"
import { getCurrentMember } from "@/lib/auth/session"
import { LoginForm } from "./login-form"

export const metadata = { title: "লগইন — সমিতি" }

export default async function LoginPage() {
  // Only a session that is still valid in the database skips the form (see proxy.ts).
  if (await getCurrentMember()) redirect("/")
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  )
}
