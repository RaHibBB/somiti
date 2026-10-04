"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/forms/form-bits"
import { rewriteSheetAction } from "./actions"

export function SheetSyncButton() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rewriteSheetAction()
            setMsg(res.ok ? { ok: true, text: "✓ শিট পুরোপুরি আপডেট হয়েছে।" } : { ok: false, text: res.error })
          })
        }
      >
        <RefreshCw className={pending ? "size-5 animate-spin" : "size-5"} /> Google Sheet এখনই পুরো আপডেট করুন
      </Button>
      {msg?.ok ? <p className="text-base text-green-800">{msg.text}</p> : <FormError message={msg?.text} />}
    </div>
  )
}
