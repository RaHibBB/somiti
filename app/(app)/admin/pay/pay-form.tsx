"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { Check, Loader2, MessageCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError } from "@/components/forms/form-bits"
import { MemberPicker } from "@/components/member-picker"
import { fromBn, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"
import { receiptMessage, waLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import { takePaymentAction, type TakePaymentResult } from "./actions"

export type PayMember = {
  id: number
  no: number
  name: string
  phone: string | null
  shares: number
  due: number
  open: { month: string; remaining: number; isDue: boolean }[]
}

type Method = "cash" | "bkash" | "nagad" | "rocket" | "bank"
const METHODS: Method[] = ["cash", "bkash", "nagad", "rocket", "bank"]

function newRef() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null
}

export function PayForm({ members, today, preselectId }: { members: PayMember[]; today: string; preselectId?: number }) {
  const [memberId, setMemberId] = useState<number | null>(
    preselectId && members.some((m) => m.id === preselectId) ? preselectId : null,
  )
  const member = members.find((m) => m.id === memberId) ?? null
  const [selected, setSelected] = useState<string[]>(() => (member?.open[0] ? [member.open[0].month] : []))
  const [amount, setAmount] = useState<string>(() => (member?.open[0] ? String(member.open[0].remaining) : ""))
  const [method, setMethod] = useState<Method>("cash")
  const [trxId, setTrxId] = useState("")
  const [note, setNote] = useState("")
  const [paidOn, setPaidOn] = useState(today)
  // One idempotency key per distinct request: retrying the same save reuses its key,
  // changing the member, months, amounts or method gets a fresh one.
  const refs = useRef(new Map<string, string | null>())
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<TakePaymentResult | null>(null)
  const [pending, startTransition] = useTransition()

  const multi = selected.length > 1
  const items = useMemo(() => {
    if (!member) return []
    if (selected.length === 1) return [{ forMonth: selected[0], amount: Number(fromBn(amount).replace(/[,\s]/g, "")) || 0 }]
    return member.open.filter((o) => selected.includes(o.month)).map((o) => ({ forMonth: o.month, amount: o.remaining }))
  }, [member, selected, amount])
  const total = items.reduce((s, i) => s + i.amount, 0)

  function pickMember(id: number) {
    const m = members.find((x) => x.id === id)!
    setMemberId(id)
    setSelected(m.open[0] ? [m.open[0].month] : [])
    setAmount(m.open[0] ? String(m.open[0].remaining) : "")
    setError(undefined)
  }

  function toggleMonth(month: string) {
    if (!member) return
    setError(undefined)
    const next = selected.includes(month) ? selected.filter((m) => m !== month) : [...selected, month]
    // keep chronological order (open[] is already sorted)
    const ordered = member.open.map((o) => o.month).filter((m) => next.includes(m))
    setSelected(ordered)
    if (ordered.length === 1) setAmount(String(member.open.find((o) => o.month === ordered[0])!.remaining))
  }

  function reset() {
    setMemberId(null)
    setSelected([])
    setAmount("")
    setMethod("cash")
    setTrxId("")
    setNote("")
    setPaidOn(today)
    refs.current.clear()
    setResult(null)
    setError(undefined)
  }

  function save() {
    if (!member) return
    if (items.length === 0) return setError("অন্তত একটি মাস বাছাই করুন।")
    if (items.some((i) => !Number.isInteger(i.amount) || i.amount <= 0)) return setError("টাকার পরিমাণ সঠিক নয়।")
    setError(undefined)
    const payloadKey = JSON.stringify([member.id, items, paidOn, method])
    if (!refs.current.has(payloadKey)) refs.current.set(payloadKey, newRef())
    const clientRef = refs.current.get(payloadKey) ?? null
    startTransition(async () => {
      const res = await takePaymentAction({
        memberId: member.id,
        items,
        paidOn,
        method,
        trxId: method === "cash" ? "" : trxId,
        note,
        clientRef,
      })
      if (res.ok) setResult(res.data)
      else setError(res.error)
    })
  }

  // ── Success screen ──
  if (result && member) {
    const msg = receiptMessage({ name: member.name, receipts: result.receipts, paidOn: result.paidOn, dueAfter: result.dueAfter })
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border-2 border-green-600 bg-green-50 p-5 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-600 text-white">
            <Check className="size-7" />
          </div>
          <p className="text-base text-green-900">জমা সংরক্ষিত হয়েছে — {member.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">রসিদ নম্বর</p>
          {result.receipts.map((r) => (
            <p key={r.receiptNo} className="font-mono text-4xl font-bold tracking-wide text-brand-navy">
              {receiptLabel(r.receiptNo)}
            </p>
          ))}
          <ul className="mt-3 space-y-1 text-base">
            {result.receipts.map((r) => (
              <li key={r.receiptNo}>
                {monthLabel(r.forMonth)} — {taka(r.amount)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            বর্তমান বকেয়া: <span className={result.dueAfter > 0 ? "font-semibold text-destructive" : ""}>{taka(result.dueAfter)}</span>
          </p>
        </div>
        <a
          href={waLink(member.phone, msg)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-lg font-semibold text-white active:opacity-90"
        >
          <MessageCircle className="size-6" /> WhatsApp-এ রসিদ পাঠান
        </a>
        {!member.phone ? <p className="text-center text-sm text-muted-foreground">এই সদস্যের মোবাইল নম্বর নেই — WhatsApp-এ কাকে পাঠাবেন বেছে নিন।</p> : null}
        <Button size="xl" variant="outline" onClick={reset}>
          <RotateCcw className="size-5" /> আরেকটি জমা নিন
        </Button>
      </div>
    )
  }

  // ── Step 1: pick member ──
  if (!member) {
    return (
      <MemberPicker
        members={members.map((m) => ({
          id: m.id,
          no: m.no,
          name: m.name,
          right: m.due > 0 ? <span className="shrink-0 text-sm font-semibold text-destructive">{taka(m.due)}</span> : null,
        }))}
        onSelect={pickMember}
      />
    )
  }

  // ── Step 2–4: months, amount, method, save ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">
            {toBn(member.no)}. {member.name}
          </p>
          <p className="text-sm text-muted-foreground">
            শেয়ার {toBn(member.shares)} · বকেয়া{" "}
            <span className={member.due > 0 ? "font-semibold text-destructive" : ""}>{taka(member.due)}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setMemberId(null)}>
          পরিবর্তন
        </Button>
      </div>

      {member.open.length === 0 ? (
        <p className="rounded-lg bg-green-50 p-3 text-base text-green-900">এই সদস্যের মেয়াদের সব মাসের চাঁদা পরিশোধিত।</p>
      ) : (
        <section className="space-y-2">
          <p className="text-base font-medium">কোন মাসের? <span className="text-sm text-muted-foreground">(একাধিক মাস বাছাই করা যায়)</span></p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {member.open.slice(0, 18).map((o) => {
              const on = selected.includes(o.month)
              return (
                <button
                  key={o.month}
                  type="button"
                  onClick={() => toggleMonth(o.month)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-14 shrink-0 rounded-xl border-2 px-3 py-1 text-left",
                    on ? "border-brand-navy bg-brand-navy text-white" : "bg-white",
                    !on && o.isDue && "border-red-300",
                  )}
                >
                  <span className="block text-sm font-semibold whitespace-nowrap">{monthLabel(o.month)}</span>
                  <span className={cn("block text-xs", on ? "text-white/80" : o.isDue ? "text-destructive" : "text-muted-foreground")}>
                    {taka(o.remaining)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {selected.length === 1 ? (
        <Field label="টাকার পরিমাণ" htmlFor="amount">
          <Input
            id="amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 text-2xl font-semibold"
          />
        </Field>
      ) : multi ? (
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-sm text-muted-foreground">{toBn(selected.length)} মাস — প্রতি মাসের পুরো বকেয়া</p>
          <p className="text-2xl font-bold text-brand-navy">মোট {taka(total)}</p>
        </div>
      ) : null}

      <section className="space-y-2">
        <p className="text-base font-medium">কীভাবে দিয়েছেন?</p>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
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

      {method !== "cash" ? (
        <Field label="ট্রানজেকশন আইডি (ঐচ্ছিক)" htmlFor="trx">
          <Input id="trx" value={trxId} onChange={(e) => setTrxId(e.target.value)} autoCapitalize="characters" />
        </Field>
      ) : null}

      <details className="rounded-xl border bg-white px-3 py-2">
        <summary className="min-h-10 cursor-pointer py-2 text-base text-muted-foreground">তারিখ / নোট পরিবর্তন</summary>
        <div className="space-y-3 pb-2">
          <Field label="জমার তারিখ" htmlFor="paidOn">
            <Input id="paidOn" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="নোট (ঐচ্ছিক)" htmlFor="note">
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
        </div>
      </details>

      <FormError message={error} />
      <Button size="xl" onClick={save} disabled={pending || items.length === 0}>
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" /> সংরক্ষণ হচ্ছে…
          </>
        ) : (
          <>সংরক্ষণ করুন · {taka(total)}</>
        )}
      </Button>
    </div>
  )
}
