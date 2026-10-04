"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { PasswordInput } from "@/components/forms/password-input"
import { changePasswordAction } from "@/lib/auth/actions"
import { updateMyEmailAction } from "./actions"

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState(changePasswordAction, undefined)
  if (state?.ok) {
    return (
      <div className="space-y-4 rounded-xl border border-green-300 bg-green-50 p-4">
        <p className="text-lg font-semibold text-green-800">✓ নতুন পাসওয়ার্ড সেট হয়েছে।</p>
        <p className="text-base">অন্য সব ফোন থেকে লগআউট হয়ে গেছে।</p>
        <Link href="/" className="block rounded-xl bg-primary py-3 text-center text-lg font-semibold text-white">
          হোমে যান
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      {forced ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-base text-amber-900">
          প্রথমবার লগইন করেছেন। নিজের একটি নতুন পাসওয়ার্ড দিন। পাসওয়ার্ড কাউকে বলবেন না।
        </p>
      ) : null}
      <Field label={forced ? "অ্যাডমিনের দেওয়া পাসওয়ার্ড" : "বর্তমান পাসওয়ার্ড"} htmlFor="current">
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </Field>
      <Field label="নতুন পাসওয়ার্ড" htmlFor="next" hint="কমপক্ষে ৬ অক্ষর। অক্ষর, সংখ্যা বা চিহ্ন — যেকোনো কিছু।">
        <PasswordInput id="next" name="next" autoComplete="new-password" required minLength={6} maxLength={64} />
      </Field>
      <Field label="নতুন পাসওয়ার্ড আবার" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton>পাসওয়ার্ড পরিবর্তন করুন</SubmitButton>
    </form>
  )
}

export function EmailForm({ email }: { email: string | null }) {
  const [state, action] = useActionState(updateMyEmailAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <Field label="আমার ইমেইল" htmlFor="email" hint="ইমেইল থাকলে পাসওয়ার্ড ভুলে গেলে নিজেই রিসেট করতে পারবেন, আর ইমেইল দিয়েও লগইন করা যাবে।">
        <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" defaultValue={email ?? ""} placeholder="you@gmail.com" />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      {state?.ok ? <p className="rounded-lg bg-green-50 px-3 py-2 text-base text-green-800">✓ সংরক্ষিত হয়েছে</p> : null}
      <SubmitButton variant="outline">ইমেইল সংরক্ষণ করুন</SubmitButton>
    </form>
  )
}
