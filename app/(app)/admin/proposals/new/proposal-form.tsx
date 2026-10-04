"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { InvestmentImpact, parseAmount } from "@/components/investment-impact"
import { createProposalAction } from "../../../proposals/actions"

export function ProposalForm({
  defaultCloseOn,
  minCloseOn,
  fund,
}: {
  defaultCloseOn: string
  minCloseOn: string
  fund: { cash: number; invested: number; minCashPct: number }
}) {
  const [state, action] = useActionState(createProposalAction, undefined)
  const [amount, setAmount] = useState("")
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border-2 border-green-600 bg-green-50 p-4 text-center text-lg text-green-900">✓ প্রস্তাব প্রকাশ হয়েছে। সদস্যরা এখন ভোট দিতে পারবেন।</p>
        <Link href={`/proposals/${state.data.id}`} className="block rounded-xl bg-primary py-3 text-center text-base text-white">
          প্রস্তাব দেখুন
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="শিরোনাম" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} placeholder="যেমন: মুরগির খামারে বিনিয়োগ" />
      </Field>
      <Field label="বিস্তারিত" htmlFor="description" hint="কী, কেন, কত দিনের জন্য, ঝুঁকি, সম্ভাব্য লাভ।">
        <Textarea id="description" name="description" required rows={5} />
      </Field>
      <Field label="টাকার পরিমাণ (বিনিয়োগ হলে)" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <InvestmentImpact {...fund} amount={parseAmount(amount)} />
      <Field label="ভোটের শেষ দিন" htmlFor="closesOn" hint="ঐ দিন রাত ১১:৫৯ পর্যন্ত ভোট দেওয়া যাবে। এর আগেও অ্যাডমিন বন্ধ করতে পারবেন।">
        <Input id="closesOn" name="closesOn" type="date" defaultValue={defaultCloseOn} min={minCloseOn} required />
      </Field>
      <p className="rounded-lg bg-muted p-3 text-sm">প্রকাশের পর প্রস্তাবের লেখা বা পরিমাণ আর বদলানো যাবে না।</p>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton>প্রকাশ করুন ও ভোট শুরু করুন</SubmitButton>
    </form>
  )
}
