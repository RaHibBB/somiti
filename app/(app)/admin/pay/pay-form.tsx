"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { Check, ChevronDown, Loader2, MessageCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError } from "@/components/forms/form-bits"
import { MemberPicker } from "@/components/member-picker"
import { fromBn, METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"
import { allocatePayment } from "@/lib/ledger"
import { receiptMessage, waLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import { takePaymentAction, type TakePaymentResult } from "./actions"
import { VoidButton } from "../void/void-button"

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

const toInt = (s: string) => Number(fromBn(s).replace(/[,\s৳]/g, "")) || 0

/** Something to pay now: overdue, or this month not yet fully paid. */
function owesNow(m: PayMember, thisMonth: string) {
  return m.due > 0 || m.open.some((o) => o.month === thisMonth)
}

export function PayForm({
  members,
  today,
  thisMonth,
  sharePrice,
  preselectId,
}: {
  members: PayMember[]
  today: string
  thisMonth: string
  sharePrice: number
  preselectId?: number
}) {
  const [memberId, setMemberId] = useState<number | null>(
    preselectId && members.some((m) => m.id === preselectId) ? preselectId : null,
  )
  const member = members.find((m) => m.id === memberId) ?? null
  const [listMode, setListMode] = useState<"owing" | "all">("owing")
  // Amount-first: the admin types what was handed over; months are filled oldest first.
  const [amount, setAmount] = useState<string>(() => (member?.open[0] ? String(member.open[0].remaining) : ""))
  // Optional manual mode: choose months yourself (e.g. to skip a month).
  const [manual, setManual] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [method, setMethod] = useState<Method>("cash")
  const [trxId, setTrxId] = useState("")
  const [note, setNote] = useState("")
  const [paidOn, setPaidOn] = useState(today)
  // One idempotency key per distinct request: retrying the same save reuses its key.
  const refs = useRef(new Map<string, string | null>())
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<TakePaymentResult | null>(null)
  const [pending, startTransition] = useTransition()

  const plan = useMemo(() => {
    if (!member) return { items: [], leftover: 0 }
    if (!manual) return allocatePayment(member.open, toInt(amount))
    const chosen = member.open.filter((o) => selected.includes(o.month))
    if (chosen.length === 1) {
      const a = toInt(amount)
      return { items: [{ forMonth: chosen[0].month, amount: a, full: a >= chosen[0].remaining }], leftover: 0 }
    }
    return { items: chosen.map((o) => ({ forMonth: o.month, amount: o.remaining, full: true })), leftover: 0 }
  }, [member, manual, selected, amount])
  const total = plan.items.reduce((s, i) => s + i.amount, 0)

  // Quick amounts: 1 month, everything overdue, 2 / 3 / 6 months.
  const quick = useMemo(() => {
    if (!member || member.open.length === 0) return []
    const sumFirst = (n: number) => member.open.slice(0, n).reduce((s, o) => s + o.remaining, 0)
    const out: { label: string; value: number }[] = [{ label: "১ মাস", value: sumFirst(1) }]
    if (member.due > 0 && member.due !== sumFirst(1)) out.push({ label: "সব বকেয়া", value: member.due })
    for (const n of [2, 3, 6]) if (member.open.length >= n) out.push({ label: `${toBn(n)} মাস`, value: sumFirst(n) })
    const seen = new Set<number>()
    return out.filter((q) => (seen.has(q.value) ? false : (seen.add(q.value), true)))
  }, [member])

  function pickMember(id: number) {
    const m = members.find((x) => x.id === id)!
    setMemberId(id)
    setAmount(m.open[0] ? String(m.open[0].remaining) : "")
    setManual(false)
    setSelected([])
    setError(undefined)
  }

  function toggleMonth(month: string) {
    if (!member) return
    setError(undefined)
    const next = selected.includes(month) ? selected.filter((m) => m !== month) : [...selected, month]
    const ordered = member.open.map((o) => o.month).filter((m) => next.includes(m))
    setSelected(ordered)
    if (ordered.length === 1) setAmount(String(member.open.find((o) => o.month === ordered[0])!.remaining))
  }

  function startManual() {
    if (!member) return
    setManual(true)
    const first = plan.items[0]?.forMonth ?? member.open[0]?.month
    setSelected(first ? [first] : [])
    if (first) setAmount(String(member.open.find((o) => o.month === first)!.remaining))
  }

  function reset() {
    setMemberId(null)
    setAmount("")
    setManual(false)
    setSelected([])
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
    if (plan.items.length === 0) return setError(manual ? "অন্তত একটি মাস বাছাই করুন।" : "টাকার পরিমাণ লিখুন।")
    if (plan.leftover > 0) return setError(`${taka(plan.leftover)} বেশি হয়ে যাচ্ছে — মেয়াদের সব মাস পরিশোধের পরও বাকি থাকে।`)
    if (plan.items.some((i) => !Number.isInteger(i.amount) || i.amount <= 0)) return setError("টাকার পরিমাণ সঠিক নয়।")
    setError(undefined)
    const items = plan.items.map(({ forMonth, amount: a }) => ({ forMonth, amount: a }))
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
    const msg = receiptMessage({
      name: member.name,
      receipts: result.receipts,
      paidOn: result.paidOn,
      dueAfter: result.dueAfter,
      currentOpenAfter: result.currentOpenAfter,
    })
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
            {result.currentOpenAfter > 0 ? <span className="text-amber-700"> · এই মাস বাকি {taka(result.currentOpenAfter)}</span> : null}
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
        <details className="rounded-xl border bg-white px-3 py-2">
          <summary className="min-h-10 cursor-pointer py-2 text-base text-muted-foreground">ভুল হয়েছে? এখনই বাতিল করুন</summary>
          <ul className="space-y-2 pb-2">
            {result.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  {receiptLabel(r.receiptNo)} · {monthLabel(r.forMonth)} · {taka(r.amount)}
                </span>
                <VoidButton kind="payment" id={r.id} label={`${receiptLabel(r.receiptNo)} (${member.name}, ${taka(r.amount)})`} />
              </li>
            ))}
          </ul>
        </details>
      </div>
    )
  }

  // ── Step 1: pick a member (those who owe something first) ──
  if (!member) {
    const owing = members.filter((m) => owesNow(m, thisMonth))
    const list = listMode === "owing" ? owing : members
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(
            [
              ["owing", `টাকা বাকি (${toBn(owing.length)})`],
              ["all", `সবাই (${toBn(members.length)})`],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={listMode === mode}
              onClick={() => setListMode(mode)}
              className={cn(
                "h-11 rounded-xl border-2 text-base",
                listMode === mode ? "border-brand-navy bg-brand-navy font-semibold text-white" : "bg-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">সবার এই মাস পর্যন্ত চাঁদা পরিশোধিত। 🎉</p>
        ) : (
          <MemberPicker
            members={list.map((m) => ({
              id: m.id,
              no: m.no,
              name: m.name,
              right:
                m.due > 0 ? (
                  <span className="shrink-0 text-right text-sm font-semibold text-destructive">বকেয়া {taka(m.due)}</span>
                ) : m.open[0]?.month === thisMonth ? (
                  <span className="shrink-0 text-sm text-amber-700">এই মাস {taka(m.open[0].remaining)}</span>
                ) : (
                  <span className="shrink-0 text-sm text-green-700">✓ পরিশোধিত</span>
                ),
            }))}
            onSelect={pickMember}
          />
        )}
      </div>
    )
  }

  // ── Step 2: how much, how, save ──
  const overdue = member.open.filter((o) => o.isDue)
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setMemberId(null)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-white p-3 text-left active:bg-muted"
      >
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold">
            {toBn(member.no)}. {member.name}
          </span>
          <span className="block text-sm text-muted-foreground">
            {toBn(member.shares)} শেয়ার · মাসে {taka(member.shares * sharePrice)}
            {member.due > 0 ? (
              <span className="font-semibold text-destructive">
                {" "}
                · বকেয়া {taka(member.due)} ({overdue.map((o) => monthLabel(o.month)).join(", ")})
              </span>
            ) : (
              ` · ${member.open[0]?.month === thisMonth ? `এই মাস বাকি ${taka(member.open[0].remaining)}` : "কোনো বকেয়া নেই"}`
            )}
          </span>
        </span>
        <span className="shrink-0 text-sm text-brand-navy underline">বদলান</span>
      </button>

      {member.open.length === 0 ? (
        <p className="rounded-lg bg-green-50 p-3 text-base text-green-900">এই সদস্যের মেয়াদের সব মাসের চাঁদা পরিশোধিত।</p>
      ) : !manual ? (
        <>
          <section className="space-y-2">
            <Field label="কত টাকা দিলেন?" htmlFor="amount">
              <Input
                id="amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError(undefined)
                }}
                onFocus={(e) => e.target.select()}
                className="h-16 text-3xl font-bold"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setAmount(String(q.value))}
                  aria-pressed={toInt(amount) === q.value}
                  className={cn(
                    "h-11 rounded-full border-2 px-3 text-sm",
                    toInt(amount) === q.value ? "border-brand-green bg-brand-green font-semibold text-white" : "bg-white",
                  )}
                >
                  {q.label} · {taka(q.value)}
                </button>
              ))}
            </div>
          </section>

          {plan.items.length ? (
            <section className="rounded-xl border bg-secondary/60 p-3">
              <p className="mb-2 text-sm text-muted-foreground">এই টাকা যে মাসগুলোতে জমা হবে (পুরনো মাস আগে):</p>
              <ul className="space-y-1">
                {plan.items.map((i) => (
                  <li key={i.forMonth} className="flex items-center justify-between gap-2 text-base">
                    <span>{monthLabel(i.forMonth)}</span>
                    <span className="flex items-center gap-2">
                      <b>{taka(i.amount)}</b>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs",
                          i.full ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900",
                        )}
                      >
                        {i.full ? "পুরো" : "আংশিক"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {plan.leftover > 0 ? (
                <p className="mt-2 text-sm font-semibold text-destructive">{taka(plan.leftover)} বেশি — মেয়াদের সব মাসের চাঁদার চেয়ে বেশি।</p>
              ) : null}
            </section>
          ) : null}

          <button type="button" onClick={startManual} className="flex min-h-10 items-center gap-1 text-sm text-brand-navy underline">
            <ChevronDown className="size-4" /> মাস নিজে বাছাই করুন
          </button>
        </>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-base font-medium">কোন মাসের?</p>
            <button type="button" onClick={() => setManual(false)} className="text-sm text-brand-navy underline">
              ← টাকা দিয়ে স্বয়ংক্রিয়ভাবে
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {member.open.slice(0, 12).map((o) => {
              const on = selected.includes(o.month)
              return (
                <button
                  key={o.month}
                  type="button"
                  onClick={() => toggleMonth(o.month)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-14 rounded-xl border-2 px-3 py-1 text-left",
                    on ? "border-brand-navy bg-brand-navy text-white" : "bg-white",
                    !on && o.isDue && "border-red-300",
                  )}
                >
                  <span className="block text-sm font-semibold">{monthLabel(o.month)}</span>
                  <span className={cn("block text-xs", on ? "text-white/80" : o.isDue ? "text-destructive" : "text-muted-foreground")}>
                    {taka(o.remaining)}
                  </span>
                </button>
              )
            })}
          </div>
          {selected.length === 1 ? (
            <Field label="টাকার পরিমাণ" htmlFor="amount-manual">
              <Input id="amount-manual" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-semibold" />
            </Field>
          ) : null}
        </section>
      )}

      {member.open.length ? (
        <>
          <section className="space-y-2">
            <p className="text-base font-medium">কীভাবে দিলেন?</p>
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
            <summary className="min-h-10 cursor-pointer py-2 text-base text-muted-foreground">
              তারিখ ({paidOn === today ? "আজ" : paidOn}) / নোট
            </summary>
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
          <Button size="xl" onClick={save} disabled={pending || plan.items.length === 0 || plan.leftover > 0}>
            {pending ? (
              <>
                <Loader2 className="size-5 animate-spin" /> সংরক্ষণ হচ্ছে…
              </>
            ) : (
              <>
                সংরক্ষণ করুন · {taka(total)}
                {plan.items.length > 1 ? ` · ${toBn(plan.items.length)} মাস` : ""}
              </>
            )}
          </Button>
        </>
      ) : null}
    </div>
  )
}
