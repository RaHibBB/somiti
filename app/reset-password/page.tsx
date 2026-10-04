import Link from "next/link"
import { AuthShell } from "@/components/layout/auth-shell"
import { getDb } from "@/lib/db"
import { checkResetToken } from "@/lib/services/password-reset"
import { ResetForm } from "./reset-form"

export const metadata = { title: "নতুন পাসওয়ার্ড — সমিতি" }

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const raw = (await searchParams).token
  const token = typeof raw === "string" ? raw : ""
  const valid = await checkResetToken(getDb(), token)
  return (
    <AuthShell title="নতুন পাসওয়ার্ড দিন">
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg bg-destructive/10 p-3 text-base text-destructive">
            লিংকটির মেয়াদ শেষ হয়ে গেছে অথবা আগেই ব্যবহার করা হয়েছে।
          </p>
          <Link href="/forgot-password" className="block rounded-xl bg-primary py-3 text-center text-base text-white">
            নতুন লিংক চান
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
