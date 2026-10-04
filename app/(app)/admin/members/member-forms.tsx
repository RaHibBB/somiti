"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { fromBn, taka, toBn } from "@/lib/format"
import { inviteMessage, waLink } from "@/lib/whatsapp"
import { cancelMemberAction, changeSharesAction, createMemberAction, resetPinAction, updateMemberAction } from "./actions"

export type MemberDefaults = {
  id?: number
  memberNo: number
  nameBn: string
  phone: string | null
  email: string | null
  role: "member" | "admin"
  joinedOn: string
  nomineeName: string | null
  nomineePhone: string | null
  notes: string | null
}

function DetailFields({ d }: { d: MemberDefaults }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="সদস্য নং" htmlFor="memberNo">
          <Input id="memberNo" name="memberNo" inputMode="numeric" defaultValue={d.memberNo} required />
        </Field>
        <Field label="নাম" htmlFor="nameBn" className="col-span-2">
          <Input id="nameBn" name="nameBn" defaultValue={d.nameBn} required />
        </Field>
      </div>
      <Field label="মোবাইল নম্বর" htmlFor="phone" hint="লগইন ও WhatsApp-এর জন্য। না থাকলে খালি রাখুন।">
        <Input id="phone" name="phone" inputMode="tel" defaultValue={d.phone ?? ""} placeholder="01XXXXXXXXX" />
      </Field>
      <Field label="ইমেইল (ঐচ্ছিক)" htmlFor="email" hint="ইমেইল দিয়ে লগইন ও পাসওয়ার্ড ভুলে গেলে রিসেট করার জন্য।">
        <Input id="email" name="email" type="email" autoCapitalize="none" defaultValue={d.email ?? ""} placeholder="you@gmail.com" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="যোগদানের তারিখ" htmlFor="joinedOn">
          <Input id="joinedOn" name="joinedOn" type="date" defaultValue={d.joinedOn} required />
        </Field>
        <Field label="ভূমিকা" htmlFor="role">
          <NativeSelect id="role" name="role" defaultValue={d.role}>
            <option value="member">সদস্য</option>
            <option value="admin">অ্যাডমিন</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="নমিনির নাম" htmlFor="nomineeName">
        <Input id="nomineeName" name="nomineeName" defaultValue={d.nomineeName ?? ""} />
      </Field>
      <Field label="নমিনির মোবাইল" htmlFor="nomineePhone">
        <Input id="nomineePhone" name="nomineePhone" inputMode="tel" defaultValue={d.nomineePhone ?? ""} />
      </Field>
      <Field label="নোট" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={d.notes ?? ""} rows={2} />
      </Field>
    </>
  )
}

export function PinReveal({ name, pin, memberNo, phone }: { name: string; pin: string; memberNo?: number; phone?: string | null }) {
  const wa =
    memberNo === undefined
      ? null
      : waLink(phone ?? null, inviteMessage({ name, memberNo, phone: phone ?? null, pin, loginUrl: `${window.location.origin}/login` }))
  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-center">
      <p className="text-base">{name}-এর অস্থায়ী পাসওয়ার্ড</p>
      <p className="my-2 font-mono text-4xl font-bold tracking-[0.3em] text-brand-navy">{toBn(pin)}</p>
      <p className="text-sm text-amber-900">
        এই পাসওয়ার্ড এখনই সদস্যকে জানিয়ে দিন — আর দেখানো হবে না। প্রথম লগইনে সদস্য নিজের পাসওয়ার্ড দেবেন।
      </p>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener"
          className="mt-3 flex h-12 items-center justify-center rounded-xl bg-[#25D366] text-base font-semibold text-white"
        >
          WhatsApp-এ পাঠান
        </a>
      ) : null}
    </div>
  )
}

export function NewMemberForm({ defaults, startMonth }: { defaults: MemberDefaults; startMonth: string }) {
  const [state, action] = useActionState(createMemberAction, undefined)
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <PinReveal name={state.data.name} pin={state.data.pin} memberNo={state.data.memberNo} phone={state.data.phone} />
        <Link href={`/admin/members/${state.data.id}`} className="block rounded-xl border bg-white py-3 text-center text-base">
          সদস্যের পাতায় যান
        </Link>
        <Link href="/admin/members/new" className="block rounded-xl bg-primary py-3 text-center text-base text-white">
          আরেকজন সদস্য যোগ করুন
        </Link>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <DetailFields d={defaults} />
      <div className="grid grid-cols-2 gap-3">
        <SharesInput defaultValue={1} label="শেয়ার সংখ্যা" />
        <Field label="শেয়ার কোন মাস থেকে" htmlFor="shareStartMonth">
          <Input id="shareStartMonth" name="shareStartMonth" type="month" defaultValue={startMonth.slice(0, 7)} required />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        নিয়ম অনুযায়ী নতুন সদস্যকে শুরু থেকেই (অক্টোবর ২০২৬) সব মাসের চাঁদা দিতে হবে।
      </p>
      <Field label="অস্থায়ী পাসওয়ার্ড (ঐচ্ছিক)" htmlFor="pin" hint="খালি রাখলে স্বয়ংক্রিয়ভাবে ৬ সংখ্যার একটি পাসওয়ার্ড তৈরি হবে।">
        <Input id="pin" name="pin" autoComplete="off" maxLength={64} />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton>সদস্য যোগ করুন</SubmitButton>
    </form>
  )
}

/** Any number of shares (no upper limit); shows the monthly amount as you type. */
function SharesInput({ defaultValue, label }: { defaultValue: number; label: string }) {
  const [value, setValue] = useState(String(defaultValue))
  const n = Number(fromBn(value))
  return (
    <Field label={label} htmlFor="shares" hint={Number.isInteger(n) && n > 0 ? `মাসে ${taka(n * 500)}` : "কমপক্ষে ১"}>
      <Input id="shares" name="shares" inputMode="numeric" required value={value} onChange={(e) => setValue(e.target.value)} />
    </Field>
  )
}

function Saved({ show }: { show: boolean }) {
  return show ? <p className="rounded-lg bg-green-50 px-3 py-2 text-base text-green-800">✓ সংরক্ষিত হয়েছে</p> : null
}

export function EditMemberForm({ defaults }: { defaults: MemberDefaults }) {
  const [state, action] = useActionState(updateMemberAction, undefined)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={defaults.id} />
      <DetailFields d={defaults} />
      <FormError message={state && !state.ok ? state.error : undefined} />
      <Saved show={!!state?.ok} />
      <SubmitButton>তথ্য সংরক্ষণ করুন</SubmitButton>
    </form>
  )
}

export function SharesForm({ id, current, defaultMonth }: { id: number; current: number; defaultMonth: string }) {
  const [state, action] = useActionState(changeSharesAction, undefined)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-3">
        <SharesInput defaultValue={current || 1} label="নতুন শেয়ার সংখ্যা" />
        <Field label="কোন মাস থেকে" htmlFor="effectiveMonth">
          <Input id="effectiveMonth" name="effectiveMonth" type="month" defaultValue={defaultMonth.slice(0, 7)} required />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">আগের মাসগুলোর হিসাব বদলাবে না।</p>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <Saved show={!!state?.ok} />
      <SubmitButton>শেয়ার পরিবর্তন করুন</SubmitButton>
    </form>
  )
}

export function ResetPinForm({ id, name, memberNo, phone }: { id: number; name: string; memberNo: number; phone: string | null }) {
  const [state, action] = useActionState(resetPinAction, undefined)
  if (state?.ok) return <PinReveal name={name} pin={state.data.pin} memberNo={memberNo} phone={phone} />
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`${name}-এর পাসওয়ার্ড রিসেট করবেন? সব ফোন থেকে লগআউট হয়ে যাবে।`)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton variant="outline">অস্থায়ী পাসওয়ার্ড তৈরি করুন</SubmitButton>
    </form>
  )
}

export function CancelMemberForm({ id, name }: { id: number; name: string }) {
  const [state, action] = useActionState(cancelMemberAction, undefined)
  if (state?.ok) return <p className="rounded-lg bg-muted px-3 py-2 text-base">সদস্যপদ বাতিল করা হয়েছে।</p>
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`${name}-এর সদস্যপদ বাতিল করবেন? হিসাব মুছবে না, কিন্তু তিনি আর লগইন করতে পারবেন না।`)) e.preventDefault()
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <Field label="বাতিলের কারণ" htmlFor="reason">
        <Textarea id="reason" name="reason" rows={2} required placeholder="যেমন: পরপর ৩ মাস চাঁদা দেননি, সভার সিদ্ধান্ত ১০/০১/২০২৭" />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton variant="destructive">সদস্যপদ বাতিল করুন</SubmitButton>
    </form>
  )
}
