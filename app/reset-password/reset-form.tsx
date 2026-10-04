"use client"

import { useActionState } from "react"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { PasswordInput } from "@/components/forms/password-input"
import { resetPasswordAction } from "@/lib/auth/actions"

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="নতুন পাসওয়ার্ড" htmlFor="next" hint="কমপক্ষে ৬ অক্ষর। অক্ষর, সংখ্যা বা চিহ্ন — যেকোনো কিছু।">
        <PasswordInput id="next" name="next" autoComplete="new-password" required minLength={6} maxLength={64} />
      </Field>
      <Field label="নতুন পাসওয়ার্ড আবার" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton>পাসওয়ার্ড সেট করুন</SubmitButton>
    </form>
  )
}
