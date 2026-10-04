"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { PasswordInput } from "@/components/forms/password-input"
import { loginAction } from "@/lib/auth/actions"

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <Field label="ইমেইল, মোবাইল নম্বর অথবা সদস্য নম্বর" htmlFor="identifier">
        <Input
          key={state?.identifier ?? ""}
          defaultValue={state?.identifier}
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="মোবাইল (০১XXXXXXXXX) বা সদস্য নং"
        />
      </Field>
      <Field label="পাসওয়ার্ড" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="inline-block py-1 text-base text-brand-navy underline-offset-4 hover:underline">
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>
      </div>
      <FormError message={state?.error} />
      <SubmitButton pendingText="ঢুকছে…">লগইন</SubmitButton>
    </form>
  )
}
