"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormError } from "@/components/forms/form-bits"
import { receiptLabel } from "@/lib/format"
import { approveReportAction, rejectReportAction } from "./actions"

// The page refreshes right after a review (the report leaves the list), so the outcome is
// shown as a toast, which lives in the root layout and survives that refresh.
export function ReviewButtons({ id, name }: { id: number; name: string }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  function run(kind: "approve" | "reject") {
    setError(undefined)
    const fd = new FormData()
    fd.set("id", String(id))
    if (kind === "reject") fd.set("reason", reason)
    start(async () => {
      if (kind === "approve") {
        const res = await approveReportAction(undefined, fd)
        if (res.ok) toast.success(`${name}: অনুমোদিত — রসিদ ${res.data.receipts.map(receiptLabel).join(", ")}`, { duration: 8000 })
        else setError(res.error)
      } else {
        const res = await rejectReportAction(undefined, fd)
        if (res.ok) toast(`${name}-এর জানানো জমা বাতিল করা হয়েছে।`)
        else setError(res.error)
      }
    })
  }

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="কেন? যেমন: বিকাশে এই আইডি পাওয়া যায়নি / টাকা কম এসেছে"
        />
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => setRejecting(false)} disabled={pending}>
            ফিরে যান
          </Button>
          <Button type="button" variant="destructive" size="lg" onClick={() => run("reject")} disabled={pending || reason.trim().length < 3}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : "বাতিল করুন"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" className="h-12 bg-brand-green text-base" onClick={() => run("approve")} disabled={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : "✓ অনুমোদন"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => setRejecting(true)} disabled={pending}>
          বাতিল
        </Button>
      </div>
      <FormError message={error} />
    </div>
  )
}
