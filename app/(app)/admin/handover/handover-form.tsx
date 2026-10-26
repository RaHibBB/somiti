"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { fromBn, taka } from "@/lib/format"
import { createHandoverAction } from "./actions"

type Admin = { id: number; name: string; balance: number }

/** "I gave ৳X to the bank / to another admin" — keeps each admin's balance honest. */
export function HandoverForm({ admins, meId, today }: { admins: Admin[]; meId: number; today: string }) {
  const router = useRouter()
  const [fromId, setFromId] = useState(meId)
  const [toId, setToId] = useState<number | "bank">("bank")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const from = admins.find((a) => a.id === fromId)
  const n = Number(fromBn(amount).replace(/[,\s৳]/g, "")) || 0
  const targets = admins.filter((a) => a.id !== fromId)
  const effectiveTo = toId !== "bank" && toId === fromId ? "bank" : toId

  function save() {
    if (n <= 0) return setError("টাকার পরিমাণ লিখুন।")
    if (from && n > from.balance && !confirm(`${from.name}-এর হাতে হিসাব অনুযায়ী ${taka(from.balance)} আছে, আপনি ${taka(n)} দিচ্ছেন। তবুও সংরক্ষণ করবেন?`)) return
    setError(undefined)
    setDone(false)
    start(async () => {
      const res = await createHandoverAction({ fromId, toId: effectiveTo === "bank" ? null : effectiveTo, amount: n, date, note })
      if (!res.ok) return setError(res.error)
      setAmount("")
      setNote("")
      setDone(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4">
      <Field label="কে দিচ্ছেন?" htmlFor="from">
        <NativeSelect id="from" value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.id === meId ? " (আমি)" : ""} — হাতে {taka(a.balance)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="কাকে / কোথায়?" htmlFor="to">
        <NativeSelect id="to" value={effectiveTo} onChange={(e) => setToId(e.target.value === "bank" ? "bank" : Number(e.target.value))}>
          <option value="bank">ব্যাংকে জমা (সমিতির অ্যাকাউন্ট)</option>
          {targets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}-কে দিয়েছি
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="টাকার পরিমাণ" htmlFor="amount">
        <Input id="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-2xl font-semibold" />
      </Field>
      <Field label="তারিখ" htmlFor="date">
        <Input id="date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="নোট (ঐচ্ছিক)" htmlFor="note">
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="যেমন: ব্যাংক স্লিপ নং, বা কেন দেওয়া হলো" />
      </Field>
      <FormError message={error} />
      {done ? (
        <p className="flex items-center gap-1 text-base text-green-700">
          <Check className="size-5" /> সংরক্ষিত হয়েছে।
        </p>
      ) : null}
      <Button size="xl" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : null} সংরক্ষণ করুন{n > 0 ? ` · ${taka(n)}` : ""}
      </Button>
    </div>
  )
}
