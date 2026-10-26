"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, LockOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/forms/form-bits"
import { closeMonthAction, reopenMonthAction } from "./actions"

export function CloseControls({ month, closed, label }: { month: string; closed: boolean; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  const [reason, setReason] = useState("")
  const [asking, setAsking] = useState(false)

  if (closed) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-base font-semibold text-green-900">
          <Lock className="size-5" /> {label}-এর হিসাব বন্ধ (চূড়ান্ত)। এই মাসের তারিখে নতুন জমা, বাতিল বা সংশোধন করা যাবে না।
        </p>
        {asking ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="কেন খুলছেন? (বাধ্যতামূলক) — যেমন: একটি জমা ভুল সদস্যের নামে হয়েছে" />
            <FormError message={error} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => setAsking(false)}>
                না
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await reopenMonthAction({ month, reason })
                    if (!res.ok) return setError(res.error)
                    setAsking(false)
                    setReason("")
                    router.refresh()
                  })
                }
              >
                {pending ? <Loader2 className="size-5 animate-spin" /> : null} মাস খুলুন
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setAsking(true)}>
            <LockOpen className="size-5" /> ভুল ঠিক করতে মাস খুলুন
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Button
        size="xl"
        disabled={pending}
        onClick={() => {
          if (!confirm(`${label}-এর হিসাব চূড়ান্ত করবেন? এরপর এই মাসের তারিখে নতুন জমা বা বাতিল করা যাবে না (দরকারে কারণ লিখে মাস খোলা যায়)।`)) return
          start(async () => {
            const res = await closeMonthAction({ month })
            if (!res.ok) return setError(res.error)
            setError(undefined)
            router.refresh()
          })
        }}
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />} {label}-এর হিসাব বন্ধ করুন
      </Button>
    </div>
  )
}
