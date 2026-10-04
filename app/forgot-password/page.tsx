import Link from "next/link"
import { AuthShell } from "@/components/layout/auth-shell"
import { mailConfigured } from "@/lib/mail"
import { ForgotForm } from "./forgot-form"

export const metadata = { title: "পাসওয়ার্ড ভুলে গেছেন — সমিতি" }

export default function ForgotPasswordPage() {
  // Without an email account configured (SMTP_*), no reset link can be sent — say so honestly.
  const emailOn = mailConfigured() || process.env.NODE_ENV !== "production"
  return (
    <AuthShell title="পাসওয়ার্ড ভুলে গেছেন?">
      {emailOn ? (
        <ForgotForm />
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg bg-secondary p-4 text-base leading-relaxed">
            যেকোনো <b>অ্যাডমিনকে</b> বলুন। তিনি আপনার পাতায় গিয়ে একটি নতুন অস্থায়ী পাসওয়ার্ড তৈরি করে দেবেন। সেটি দিয়ে লগইন করে নিজের নতুন পাসওয়ার্ড দিন।
          </p>
          <Link href="/login" className="block rounded-xl bg-primary py-3 text-center text-base text-white">
            ← লগইন পাতায় ফিরুন
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
