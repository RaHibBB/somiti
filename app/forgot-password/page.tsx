import { AuthShell } from "@/components/layout/auth-shell"
import { ForgotForm } from "./forgot-form"

export const metadata = { title: "পাসওয়ার্ড ভুলে গেছেন — সমিতি" }

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="পাসওয়ার্ড ভুলে গেছেন?">
      <ForgotForm />
    </AuthShell>
  )
}
