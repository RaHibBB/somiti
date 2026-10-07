"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FormError } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"
import { receiptMessage, waLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import { bulkPayAction, type BulkResult } from "./actions"

export type BulkMember = { id: number; no: number; name: string; remaining: number; expected: number }

type Method = "cash" | "bkash" | "nagad" | "rocket" | "bank"

export function BulkPayForm({
  month,
  months,
  members,
  today,
}: {
  month: string
  months: string[]
  members: BulkMember[]
  today: string
}) {
  const router = useRouter()
  const payable = members.filter((m) => m.remaining > 0)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [method, setMethod] = useState<Method>("cash")
  const [paidOn, setPaidOn] = useState(today)
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<BulkResult | null>(null)
  const [pending, start] = useTransition()
  // Same batch id for retries of the same selection; a new one after a change.
  const refs = useRef(new Map<string, string>())

  const total = useMemo(() => payable.filter((m) => picked.has(m.id)).reduce((s, m) => s + m.remaining, 0), [payable, picked])
  const allPicked = payable.length > 0 && payable.every((m) => picked.has(m.id))

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function save() {
    if (picked.size === 0) return setError("অন্তত একজন সদস্য বাছাই করুন।")
    setError(undefined)
    const ids = [...picked].sort((a, b) => a - b)
    const key = JSON.stringify([month, ids, paidOn, method])
    if (!refs.current.has(key)) refs.current.set(key, crypto.randomUUID())
    start(async () => {
      const res = await bulkPayAction({ forMonth: month, memberIds: ids, paidOn, method, batchRef: refs.current.get(key)! })
      if (res.ok) setResult(res.data)
      else setError(res.error)
    })
  }

  if (result) {
    const sum = result.saved.reduce((s, r) => s + r.amount, 0)
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-green-600 bg-green-50 p-4 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-600 text-white">
            <Check className="size-7" />
          </div>
          <p className="text-lg font-semibold text-green-900">
            {toBn(result.saved.length)} জনের জমা সংরক্ষিত — মোট {taka(sum)}
          </p>
          <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {result.saved.map((r) => (
            <li key={r.memberId} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{r.name}</span>
                <span className="block font-mono text-sm text-muted-foreground">
                  {receiptLabel(r.receiptNo)} · {taka(r.amount)}
                </span>
              </span>
              <a
                href={waLink(
                  r.phone,
                  receiptMessage({ name: r.name, receipts: [{ receiptNo: r.receiptNo, forMonth: month, amount: r.amount }], paidOn, dueAfter: r.dueAfter }),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white"
              >
                <MessageCircle className="size-4" /> রসিদ
              </a>
              <a
                href={`/print/receipt/${r.receiptNo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold text-brand-navy"
              >
                PDF
              </a>
            </li>
          ))}
        </ul>
        {result.skipped.length ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">নেওয়া হয়নি:</p>
            {result.skipped.map((s) => (
              <p key={s.memberId}>
                {s.name} — {s.reason}
              </p>
            ))}
          </div>
        ) : null}
        <Button
          size="xl"
          variant="outline"
          onClick={() => {
            setResult(null)
            setPicked(new Set())
            refs.current.clear()
            router.refresh()
          }}
        >
          আবার একসাথে জমা নিন
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        সভার দিনে অনেকে একসাথে চাঁদা দিলে: যারা দিয়েছেন তাদের টিক দিন। প্রত্যেকের ঐ মাসের পুরো বাকি টাকা জমা হবে, আলাদা রসিদসহ। আংশিক জমার জন্য{" "}
        <Link href="/admin/pay" className="text-brand-navy underline">
          সাধারণ জমা
        </Link>{" "}
        ব্যবহার করুন।
      </p>

      <Field label="কোন মাসের চাঁদা" htmlFor="month">
        <NativeSelect id="month" value={month.slice(0, 7)} onChange={(e) => router.push(`/admin/pay/bulk?month=${e.target.value}`)}>
          {months.map((m) => (
            <option key={m} value={m.slice(0, 7)}>
              {monthLabel(m)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="flex items-center justify-between">
        <p className="text-base">
          বাকি আছে {toBn(payable.length)} জনের · বাছাই {toBn(picked.size)} জন
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={payable.length === 0}
          onClick={() => setPicked(allPicked ? new Set() : new Set(payable.map((m) => m.id)))}
        >
          {allPicked ? "সব বাদ" : "সবাই"}
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {members.map((m) => {
          const done = m.remaining <= 0
          const on = picked.has(m.id)
          return (
            <li key={m.id}>
              <label
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2",
                  done ? "cursor-default bg-muted/50 text-muted-foreground" : on ? "bg-green-50" : "active:bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  className="size-6 shrink-0 accent-green-700"
                  checked={on}
                  disabled={done}
                  onChange={() => toggle(m.id)}
                />
                <span className="w-8 shrink-0 text-center text-sm font-semibold text-brand-navy">{toBn(m.no)}</span>
                <span className="min-w-0 flex-1 truncate text-base">{m.name}</span>
                <span className="shrink-0 text-sm">
                  {done ? <span className="text-green-700">✓ পরিশোধিত</span> : taka(m.remaining)}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <section className="space-y-2">
        <p className="text-base font-medium">কীভাবে দিয়েছেন?</p>
        <div className="grid grid-cols-3 gap-2">
          {(["cash", "bkash", "nagad", "rocket", "bank"] as Method[]).map((m) => (
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

      <Field label="জমার তারিখ" htmlFor="paidOn">
        <Input id="paidOn" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
      </Field>

      <FormError message={error} />
      <div className="sticky bottom-20 z-10">
        <Button size="xl" onClick={save} disabled={pending || picked.size === 0} className="shadow-lg">
          {pending ? (
            <>
              <Loader2 className="size-5 animate-spin" /> সংরক্ষণ হচ্ছে…
            </>
          ) : (
            <>
              {toBn(picked.size)} জনের জমা সংরক্ষণ · {taka(total)}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
