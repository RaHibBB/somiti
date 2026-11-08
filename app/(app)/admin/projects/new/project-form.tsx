"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FormError, SubmitButton } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { taka, toBn } from "@/lib/format"
import { createProjectAction } from "../../../projects/actions"

export function NewProjectForm({
  today,
  proposals,
  initialProposalId = null,
}: {
  today: string
  proposals: { id: number; title: string; amount: number | null }[]
  initialProposalId?: number | null
}) {
  const router = useRouter()
  const [state, action] = useActionState(createProjectAction, undefined)
  useEffect(() => {
    if (state?.ok) router.push(`/projects/${state.data.id}`)
  }, [state, router])

  return (
    <form action={action} className="space-y-4">
      <Field label="প্রকল্পের নাম" htmlFor="name" hint="যেমন: কোরবানির গরু ২০২৭, দুধের গাভী-১">
        <Input id="name" name="name" required maxLength={120} defaultValue={proposals.find((p) => p.id === initialProposalId)?.title ?? ""} />
      </Field>
      <Field label="শুরুর তারিখ" htmlFor="startedOn">
        <Input id="startedOn" name="startedOn" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="কোন প্রস্তাবের ভিত্তিতে? (ঐচ্ছিক)" htmlFor="proposalId" hint="নিয়ম অনুযায়ী বিনিয়োগের আগে সদস্যদের ভোটে প্রস্তাব পাস হওয়া ভালো।">
        <NativeSelect id="proposalId" name="proposalId" defaultValue={initialProposalId ? String(initialProposalId) : ""}>
          <option value="">— প্রস্তাব ছাড়া —</option>
          {proposals.map((p) => (
            <option key={p.id} value={p.id}>
              #{toBn(p.id)} {p.title}
              {p.amount ? ` (${taka(p.amount)})` : ""}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="বাজেট (ঐচ্ছিক)" htmlFor="budget" hint="খালি রাখলে প্রস্তাবের টাকাই বাজেট ধরা হবে। বাজেট ছাড়ালে প্রকল্পের পাতায় দেখাবে।">
        <Input id="budget" name="budget" inputMode="numeric" placeholder="যেমন: ১০০০০০" />
      </Field>
      <Field label="বিবরণ (ঐচ্ছিক)" htmlFor="description">
        <Textarea id="description" name="description" rows={3} maxLength={1000} placeholder="যেমন: কোরবানির হাটে বিক্রির জন্য একটি ষাঁড় কেনা হবে, লালন-পালন করবেন …" />
      </Field>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <SubmitButton>প্রকল্প খুলুন</SubmitButton>
    </form>
  )
}
