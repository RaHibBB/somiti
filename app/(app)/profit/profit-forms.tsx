"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { taka } from "@/lib/format"
import { saveDistributionAction, voidDistributionAction } from "./actions"

export function SaveDistributionForm({ year, distributed, today }: { year: number; distributed: number; today: string }) {
  const [state, action] = useActionState(saveDistributionAction, undefined)
  if (state?.ok) return <p className="rounded-lg bg-green-50 p-3 text-base text-green-800">✓ বণ্টন সংরক্ষিত হয়েছে।</p>
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("এই বণ্টন চূড়ান্ত হিসেবে সংরক্ষণ করবেন?")) e.preventDefault()
      }}
      className="space-y-3"
    >
      <input type="hidden" name="year" value={year} />
      <label className="flex items-start gap-2 text-base">
        <input type="checkbox" name="recordDividend" defaultChecked className="mt-1 size-5" />
        <span>লভ্যাংশ {taka(distributed)} সদস্যদের দেওয়া হয়েছে/হবে — আয়-ব্যয়ে &quot;লভ্যাংশ&quot; হিসেবে লিখুন</span>
      </label>
      <Field label="লভ্যাংশ দেওয়ার তারিখ" htmlFor="paidOn">
        <Input id="paidOn" name="paidOn" type="date" defaultValue={today} required />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton>বণ্টন সংরক্ষণ করুন</SubmitButton>
    </form>
  )
}

export function VoidDistributionForm({ id }: { id: number }) {
  const [state, action] = useActionState(voidDistributionAction, undefined)
  const [open, setOpen] = useState(false)
  if (state?.ok) return <p className="text-sm text-destructive">বাতিল করা হয়েছে</p>
  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        বাতিল
      </Button>
    )
  }
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="reason" required rows={2} placeholder="বাতিলের কারণ (সাথে লেখা লভ্যাংশ লেনদেনও বাতিল হবে)" />
      <FormError message={state && !state.ok ? state.error : undefined} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
          না
        </Button>
        <SubmitButton variant="destructive" className="h-12 text-base">
          হ্যাঁ, বাতিল
        </SubmitButton>
      </div>
    </form>
  )
}
