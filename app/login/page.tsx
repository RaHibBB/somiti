import Link from "next/link"
import { redirect } from "next/navigation"
import { AuthShell } from "@/components/layout/auth-shell"
import { getCurrentMember } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/next-path"
import { LoginForm } from "./login-form"

export const metadata = { title: "লগইন — সমিতি" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next)
  // Only a session that is still valid in the database skips the form (see proxy.ts).
  if (await getCurrentMember()) redirect(next)
  return (
    <AuthShell>
      <p className="mb-4 rounded-lg bg-secondary p-3 text-sm">
        হিসাব দেখতে লগইন লাগে না। জমা জানাতে, ভোট দিতে বা অ্যাডমিনের কাজের জন্য লগইন করুন।
      </p>
      <LoginForm next={next} />
      <Link href="/" className="mt-4 block py-2 text-center text-base text-brand-navy">
        ← লগইন ছাড়া হিসাব দেখুন
      </Link>
    </AuthShell>
  )
}
