"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormError, SubmitButton } from "@/components/forms/form-bits"
import { voidAction } from "./actions"

export function VoidButton({ kind, id, label }: { kind: "payment" | "transaction"; id: number; label: string }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(voidAction, undefined)
  if (state?.ok) return <p className="text-sm font-semibold text-destructive">বাতিল করা হয়েছে</p>
  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        বাতিল
      </Button>
    )
  }
  return (
    <form action={action} className="mt-2 w-full space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm">
        <b>{label}</b> বাতিল করবেন? টাকা হিসাব থেকে বাদ যাবে, কিন্তু রেকর্ড &quot;বাতিল&quot; হিসেবে থেকে যাবে।
      </p>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Textarea name="reason" required rows={2} placeholder="কারণ (বাধ্যতামূলক) — যেমন: ভুল সদস্যের নামে লেখা হয়েছে" />
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
