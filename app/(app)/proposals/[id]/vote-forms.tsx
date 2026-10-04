"use client"

import { useActionState, useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError, SubmitButton } from "@/components/forms/form-bits"
import { cn } from "@/lib/utils"
import { closeProposalAction, voteAction } from "../actions"

export function VoteForm({ proposalId }: { proposalId: number }) {
  const [state, action] = useActionState(voteAction, undefined)
  const [choice, setChoice] = useState<"yes" | "no" | null>(null)
  if (state?.ok) return <p className="rounded-xl bg-green-50 p-4 text-center text-lg text-green-800">✓ আপনার ভোট নেওয়া হয়েছে। ধন্যবাদ!</p>
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={proposalId} />
      <input type="hidden" name="choice" value={choice ?? ""} />
      <p className="text-base font-medium">আপনার ভোট দিন</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setChoice("yes")}
          aria-pressed={choice === "yes"}
          className={cn(
            "flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-lg font-semibold",
            choice === "yes" ? "border-green-700 bg-green-700 text-white" : "border-green-300 bg-white text-green-800",
          )}
        >
          <ThumbsUp className="size-6" /> হ্যাঁ
        </button>
        <button
          type="button"
          onClick={() => setChoice("no")}
          aria-pressed={choice === "no"}
          className={cn(
            "flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-lg font-semibold",
            choice === "no" ? "border-red-700 bg-red-700 text-white" : "border-red-300 bg-white text-red-800",
          )}
        >
          <ThumbsDown className="size-6" /> না
        </button>
      </div>
      {choice ? (
        <>
          <p className="text-center text-sm text-muted-foreground">ভোট একবার দিলে আর পরিবর্তন করা যাবে না।</p>
          <SubmitButton>&quot;{choice === "yes" ? "হ্যাঁ" : "না"}&quot; ভোট নিশ্চিত করুন</SubmitButton>
        </>
      ) : null}
      <FormError message={state && !state.ok ? state.error : undefined} />
    </form>
  )
}

export function CloseProposalForm({ proposalId }: { proposalId: number }) {
  const [state, action] = useActionState(closeProposalAction, undefined)
  const [open, setOpen] = useState(false)
  if (state?.ok) return <p className="text-base text-green-800">✓ ভোট বন্ধ করা হয়েছে।</p>
  if (!open) {
    return (
      <Button variant="outline" size="lg" className="w-full" onClick={() => setOpen(true)}>
        এখনই ভোট বন্ধ করুন
      </Button>
    )
  }
  return (
    <form action={action} className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <input type="hidden" name="id" value={proposalId} />
      <p className="text-base">ভোট বন্ধ করলে ফলাফল চূড়ান্ত হবে, আর কেউ ভোট দিতে পারবেন না। নিশ্চিত?</p>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
          না
        </Button>
        <SubmitButton className="h-12 text-base">হ্যাঁ, বন্ধ করুন</SubmitButton>
      </div>
    </form>
  )
}
