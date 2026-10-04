"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FormError } from "@/components/forms/form-bits"
import { fromBn, METHOD_LABELS, monthLabel, taka, toBn } from "@/lib/format"
import { cn } from "@/lib/utils"
import { submitReportAction } from "./actions"

type Open = { month: string; remaining: number; isDue: boolean }
type Method = "bkash" | "nagad" | "rocket" | "bank"

export function ReportForm({ open, today }: { open: Open[]; today: string }) {
  const [selected, setSelected] = useState<string[]>(() => (open[0] ? [open[0].month] : []))
  const [amount, setAmount] = useState(() => (open[0] ? String(open[0].remaining) : ""))
  const [method, setMethod] = useState<Method>("bkash")
  const [trxId, setTrxId] = useState("")
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const items = useMemo(() => {
    if (selected.length === 1) return [{ forMonth: selected[0], amount: Number(fromBn(amount).replace(/[,\s৳]/g, "")) || 0 }]
    return open.filter((o) => selected.includes(o.month)).map((o) => ({ forMonth: o.month, amount: o.remaining }))
  }, [open, selected, amount])
  const total = items.reduce((s, i) => s + i.amount, 0)

  function toggle(month: string) {
    const next = selected.includes(month) ? selected.filter((m) => m !== month) : [...selected, month]
    const ordered = open.map((o) => o.month).filter((m) => next.includes(m))
    setSelected(ordered)
    if (ordered.length === 1) setAmount(String(open.find((o) => o.month === ordered[0])!.remaining))
  }

  function submit() {
    setError(undefined)
    start(async () => {
      const res = await submitReportAction({ items, method, trxId, paidOn, note })
      if (res.ok) setDone(true)
      else setError(res.error)
    })
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-2xl border-2 border-green-600 bg-green-50 p-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-600 text-white">
          <Check className="size-7" />
        </div>
        <p className="text-lg font-semibold text-green-900">জানানো হয়েছে — {taka(total)}</p>
        <p className="text-base">অ্যাডমিন বিকাশ/নগদে মিলিয়ে দেখে অনুমোদন দিলে আপনার হিসাবে জমা হবে এবং রসিদ নম্বর পাবেন।</p>
        <Link href="/" className="block rounded-xl bg-primary py-3 text-base text-white">
          হোমে যান
        </Link>
      </div>
    )
  }

  if (open.length === 0) {
    return <p className="rounded-xl bg-green-50 p-4 text-base text-green-900">জানানোর মতো কোনো বাকি মাস নেই। ধন্যবাদ!</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        বিকাশ/নগদে সমিতির নম্বরে টাকা পাঠিয়ে থাকলে এখানে জানান। অ্যাডমিন মিলিয়ে দেখে অনুমোদন দিলে তবেই হিসাবে জমা হবে।
      </p>

      <section className="space-y-2">
        <p className="text-base font-medium">কোন মাসের?</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {open.slice(0, 18).map((o) => {
            const on = selected.includes(o.month)
            return (
              <button
                key={o.month}
                type="button"
                onClick={() => toggle(o.month)}
                aria-pressed={on}
                className={cn(
                  "min-h-14 shrink-0 rounded-xl border-2 px-3 py-1 text-left",
                  on ? "border-brand-navy bg-brand-navy text-white" : "bg-white",
                  !on && o.isDue && "border-red-300",
                )}
              >
                <span className="block text-sm font-semibold whitespace-nowrap">{monthLabel(o.month)}</span>
                <span className={cn("block text-xs", on ? "text-white/80" : "text-muted-foreground")}>{taka(o.remaining)}</span>
              </button>
            )
          })}
        </div>
      </section>

      {selected.length === 1 ? (
        <Field label="কত টাকা পাঠিয়েছেন" htmlFor="amount">
          <Input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-semibold" />
        </Field>
      ) : selected.length > 1 ? (
        <p className="rounded-xl bg-secondary p-3 text-xl font-bold text-brand-navy">
          {toBn(selected.length)} মাস — মোট {taka(total)}
        </p>
      ) : null}

      <section className="space-y-2">
        <p className="text-base font-medium">কীভাবে পাঠিয়েছেন?</p>
        <div className="grid grid-cols-4 gap-2">
          {(["bkash", "nagad", "rocket", "bank"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={cn(
                "h-12 rounded-xl border-2 text-base",
                method === m ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white",
              )}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </section>

      <Field label="ট্রানজেকশন আইডি (TrxID)" htmlFor="trx" hint="টাকা পাঠানোর পর বিকাশ/নগদের মেসেজে থাকে, যেমন 9JK4ABCD12">
        <Input id="trx" value={trxId} onChange={(e) => setTrxId(e.target.value)} autoCapitalize="characters" autoComplete="off" className="font-mono uppercase" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="কবে পাঠিয়েছেন" htmlFor="paidOn">
          <Input id="paidOn" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="নোট (ঐচ্ছিক)" htmlFor="note">
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: অন্য নম্বর থেকে" />
        </Field>
      </div>

      <FormError message={error} />
      <Button size="xl" onClick={submit} disabled={pending || items.length === 0 || trxId.trim().length < 4}>
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" /> পাঠানো হচ্ছে…
          </>
        ) : (
          <>অ্যাডমিনকে জানান · {taka(total)}</>
        )}
      </Button>
    </div>
  )
}
