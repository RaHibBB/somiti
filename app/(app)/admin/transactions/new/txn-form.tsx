"use client"

import { useActionState, useRef, useState } from "react"
import Link from "next/link"
import { Camera, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { InvestmentImpact, parseAmount } from "@/components/investment-impact"
import { taka, toBn, TXN_TYPE_LABELS } from "@/lib/format"
import { compressImage } from "@/lib/image-compress"
import { createTransactionAction } from "./actions"

export type PassedProposal = { id: number; title: string; amount: number | null }

export function TransactionForm({
  today,
  fund,
  proposals,
}: {
  today: string
  fund: { cash: number; invested: number; minCashPct: number }
  proposals: PassedProposal[]
}) {
  const [state, formAction] = useActionState(createTransactionAction, undefined)
  const [type, setType] = useState("expense")
  const [amount, setAmount] = useState("")
  const isInvestment = type === "investment"
  const photo = useRef<File | null>(null)
  const [preview, setPreview] = useState<{ url: string; kb: number } | null>(null)
  const [photoError, setPhotoError] = useState<string>()
  const [compressing, setCompressing] = useState(false)

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setPhotoError(undefined)
    setCompressing(true)
    try {
      const small = await compressImage(file)
      photo.current = small
      setPreview({ url: URL.createObjectURL(small), kb: Math.round(small.size / 1024) })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "ছবি নেওয়া যায়নি।")
    } finally {
      setCompressing(false)
    }
  }

  function clearPhoto() {
    photo.current = null
    setPreview(null)
  }

  async function submit(fd: FormData) {
    if (photo.current) fd.set("photo", photo.current)
    return formAction(fd)
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border-2 border-green-600 bg-green-50 p-4 text-center text-lg text-green-900">
          ✓ সংরক্ষিত হয়েছে (নং {toBn(state.data.id)})
        </p>
        <Link href="/admin/transactions/new" className="block rounded-xl bg-primary py-3 text-center text-base text-white">
          আরেকটি যোগ করুন
        </Link>
        <Link href="/transactions" className="block rounded-xl border bg-white py-3 text-center text-base">
          সব আয়-ব্যয় দেখুন
        </Link>
      </div>
    )
  }

  return (
    <form action={submit} className="space-y-4">
      <Field label="ধরন" htmlFor="type">
        <NativeSelect id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(TXN_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="টাকা" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            inputMode="numeric"
            required
            className="text-xl font-semibold"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="তারিখ" htmlFor="date">
          <Input id="date" name="date" type="date" defaultValue={today} max={today} required />
        </Field>
      </div>
      {isInvestment ? (
        <div className="space-y-3 rounded-xl border border-brand-navy/30 bg-secondary/50 p-3">
          <InvestmentImpact {...fund} amount={parseAmount(amount)} />
          <Field label="কোন প্রস্তাবের ভিত্তিতে?" htmlFor="proposalId" hint="নিয়ম অনুযায়ী বিনিয়োগের আগে সদস্যদের ভোটে প্রস্তাব পাস হতে হয়।">
            <NativeSelect id="proposalId" name="proposalId" defaultValue="">
              <option value="">— প্রস্তাব ছাড়া —</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  #{toBn(p.id)} {p.title}
                  {p.amount ? ` (${taka(p.amount)})` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {proposals.length === 0 ? <p className="text-sm text-amber-900">এখনো কোনো পাস হওয়া প্রস্তাব নেই।</p> : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="acceptRuleBreak" className="mt-1 size-5" />
            <span>৭০/৩০ নিয়মের বাইরে গেলেও (নগদ ৩০%-এর নিচে) জেনে-বুঝে সংরক্ষণ করছি</span>
          </label>
        </div>
      ) : null}
      <Field label="বিবরণ" htmlFor="description">
        <Textarea id="description" name="description" rows={2} required placeholder="কী বাবদ, কাকে দেওয়া হয়েছে" />
      </Field>

      <div className="space-y-2">
        <p className="text-base font-medium">রসিদের ছবি (ঐচ্ছিক)</p>
        {preview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt="রসিদ" className="max-h-48 rounded-lg border" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute -top-2 -right-2 flex size-9 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label="ছবি সরান"
            >
              <X className="size-5" />
            </button>
            <p className="mt-1 text-sm text-muted-foreground">{toBn(preview.kb)} KB</p>
          </div>
        ) : (
          <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white text-base text-muted-foreground">
            <Camera className="size-6" /> {compressing ? "ছবি ছোট করা হচ্ছে…" : "ছবি তুলুন / বাছাই করুন"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
          </label>
        )}
        <FormError message={photoError} />
      </div>

      <details className="rounded-xl border bg-white px-3 py-2">
        <summary className="min-h-10 cursor-pointer py-2 text-base text-muted-foreground">অনুমোদন / সভার তথ্য</summary>
        <div className="space-y-3 pb-2">
          <Field label="কে অনুমোদন করেছেন" htmlFor="approvedBy">
            <Input id="approvedBy" name="approvedBy" placeholder="যেমন: সভার সিদ্ধান্ত" />
          </Field>
          <Field label="সভার তারিখ" htmlFor="meetingDate">
            <Input id="meetingDate" name="meetingDate" type="date" />
          </Field>
          <Field label="ভোটের ফল" htmlFor="voteResult">
            <Input id="voteResult" name="voteResult" placeholder="যেমন: হ্যাঁ ২০, না ৩" />
          </Field>
        </div>
      </details>

      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton>সংরক্ষণ করুন</SubmitButton>
    </form>
  )
}
