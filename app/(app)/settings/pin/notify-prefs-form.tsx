"use client"

import { useActionState } from "react"
import { SubmitButton } from "@/components/forms/form-bits"
import { NOTIFY_KINDS, NOTIFY_KIND_KEYS } from "@/lib/notify-kinds"
import { saveNotifyPrefsAction } from "@/app/(app)/notifications/actions"

/** Tick the kinds of news the member wants (on this and every other device). */
export function NotifyPrefsForm({ off, isAdmin }: { off: string[]; isAdmin: boolean }) {
  const [state, action] = useActionState(saveNotifyPrefsAction, undefined)
  const kinds = NOTIFY_KIND_KEYS.filter((k) => !NOTIFY_KINDS[k].admin || isAdmin)
  return (
    <form action={action} className="space-y-2">
      <p className="text-base font-medium">কোন খবর পাবেন</p>
      {kinds.map((k) => (
        <label key={k} className="flex min-h-11 items-start gap-3 rounded-lg border bg-white px-3 py-2 text-base">
          <input type="checkbox" name="kind" value={k} defaultChecked={!off.includes(k)} className="mt-1 size-5 shrink-0" />
          <span>{NOTIFY_KINDS[k].label}</span>
        </label>
      ))}
      {state?.ok ? <p className="text-sm text-green-800">✓ সংরক্ষিত হয়েছে</p> : null}
      <SubmitButton variant="outline">পছন্দ সংরক্ষণ করুন</SubmitButton>
    </form>
  )
}
