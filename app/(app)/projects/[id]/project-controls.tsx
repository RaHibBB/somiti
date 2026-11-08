"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, LockOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError } from "@/components/forms/form-bits"
import { taka } from "@/lib/format"
import { closeProjectAction, reopenProjectAction } from "../actions"

/** Close a project (sold / finished) or reopen it with a reason. */
export function ProjectControls({
  id,
  name,
  closed,
  today,
  minDate,
  result,
}: {
  id: number
  name: string
  closed: boolean
  today: string
  /** Earliest allowed closing date: the last entry's date (or the start date). */
  minDate: string
  result: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [closedOn, setClosedOn] = useState(today)
  const [text, setText] = useState("")

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(undefined)
    start(async () => {
      const res = await fn()
      if (res.ok) {
        setOpen(false)
        setText("")
        router.refresh()
      } else setError(res.error)
    })
  }

  if (!open) {
    return closed ? (
      <Button variant="outline" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <LockOpen className="size-5" /> প্রকল্প আবার খুলুন
      </Button>
    ) : (
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        <Lock className="size-5" /> প্রকল্প শেষ করুন (বিক্রি / সমাপ্ত)
      </Button>
    )
  }

  if (closed) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
        <p className="text-sm">আবার খুললে লাভ-ক্ষতি আর মুনাফায় ধরা হবে না, যতক্ষণ না আবার শেষ করেন।</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="কেন খুলছেন? (বাধ্যতামূলক) — যেমন: একটি খরচ লেখা বাকি ছিল" />
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
            না
          </Button>
          <Button variant="destructive" size="lg" disabled={pending || text.trim().length < 3} onClick={() => run(() => reopenProjectAction({ id, reason: text }))}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : null} খুলুন
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-brand-navy/40 bg-secondary/40 p-3">
      <p className="text-base">
        <b>{name}</b> শেষ করবেন? সব খরচ ও বিক্রির টাকা লেখা হয়ে গেলে তবেই শেষ করুন।
      </p>
      <p className={result >= 0 ? "text-base font-semibold text-green-800" : "text-base font-semibold text-destructive"}>
        {result >= 0 ? `লাভ ${taka(result)}` : `ক্ষতি ${taka(-result)}`} — শেষের তারিখের বছরের মুনাফা বণ্টনে যোগ হবে।
      </p>
      <Field label="কবে শেষ হলো (বিক্রির তারিখ)" htmlFor="closedOn">
        <Input id="closedOn" type="date" value={closedOn} min={minDate} max={today} onChange={(e) => setClosedOn(e.target.value)} />
      </Field>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="নোট (ঐচ্ছিক) — যেমন: মীরসরাই হাটে বিক্রি" />
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={() => setOpen(false)}>
          না
        </Button>
        <Button size="lg" disabled={pending || !closedOn} onClick={() => run(() => closeProjectAction({ id, closedOn, note: text }))}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : null} শেষ করুন
        </Button>
      </div>
    </div>
  )
}
