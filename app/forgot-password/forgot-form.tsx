"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { forgotPasswordAction } from "@/lib/auth/actions"

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined)
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-green-50 p-3 text-base text-green-900">
          এই ইমেইলে কোনো অ্যাকাউন্ট থাকলে পাসওয়ার্ড বদলানোর লিংক পাঠানো হয়েছে। ইনবক্স (এবং Spam ফোল্ডার) দেখুন। লিংকটি ৩০ মিনিট কাজ করবে। কয়েক মিনিটেও না এলে অ্যাডমিনকে বলুন।
        </p>
        <Link href="/login" className="block rounded-xl border py-3 text-center text-base">
          লগইন পাতায় ফিরুন
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <p className="text-base text-muted-foreground">আপনার অ্যাকাউন্টের ইমেইল দিন। নতুন পাসওয়ার্ড দেওয়ার লিংক পাঠানো হবে।</p>
      <Field label="ইমেইল" htmlFor="email">
        <Input
          key={state?.identifier ?? ""}
          defaultValue={state?.identifier}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          placeholder="you@gmail.com"
        />
      </Field>
      <FormError message={state?.error} />
      <SubmitButton pendingText="পাঠানো হচ্ছে…">লিংক পাঠান</SubmitButton>
      <p className="rounded-lg bg-muted p-3 text-sm">
        অ্যাকাউন্টে ইমেইল দেওয়া না থাকলে যেকোনো অ্যাডমিনকে বলুন — তিনি একটি অস্থায়ী পাসওয়ার্ড দেবেন।
      </p>
      <Link href="/login" className="block py-2 text-center text-base text-brand-navy">
        ← লগইন পাতায় ফিরুন
      </Link>
    </form>
  )
}
