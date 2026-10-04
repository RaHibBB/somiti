"use client"

import { useActionState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { createNoticeAction, setNoticeStatusAction } from "./actions"

export function NewNoticeForm() {
  const [state, action] = useActionState(createNoticeAction, undefined)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) form.current?.reset()
  }, [state])
  return (
    <form ref={form} action={action} className="space-y-3">
      <Field label="শিরোনাম" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} placeholder="যেমন: মাসিক সভা ১৫ নভেম্বর" />
      </Field>
      <Field label="লেখা" htmlFor="body">
        <Textarea id="body" name="body" required rows={4} />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      {state?.ok ? <p className="rounded-lg bg-green-50 px-3 py-2 text-base text-green-800">✓ নোটিশ প্রকাশিত হয়েছে</p> : null}
      <SubmitButton>নোটিশ প্রকাশ করুন</SubmitButton>
    </form>
  )
}

export function NoticeStatusButton({ id, archived }: { id: number; archived: boolean }) {
  const [state, action, pending] = useActionState(setNoticeStatusAction, undefined)
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={archived ? "active" : "archived"} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {archived ? "আবার দেখান" : "সরিয়ে রাখুন"}
      </Button>
      {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
