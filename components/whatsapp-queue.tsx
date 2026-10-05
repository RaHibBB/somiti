"use client"

import { useState } from "react"
import { Check, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toBn } from "@/lib/format"

export type QueueItem = { id: number; label: string; link: string; hasPhone: boolean }

/** "Send to everyone, one tap each": opens the next prefilled WhatsApp chat and marks it sent. */
export function WhatsappQueue({ items, verb = "পাঠান" }: { items: QueueItem[]; verb?: string }) {
  const [sent, setSent] = useState<Set<number>>(new Set())
  if (items.length === 0) return null
  const next = items.find((i) => !sent.has(i.id)) ?? null

  function go(i: QueueItem) {
    window.open(i.link, "_blank", "noopener")
    setSent((prev) => new Set(prev).add(i.id))
  }

  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-sm">
        {verb}: <b>{toBn(sent.size)}</b> / {toBn(items.length)} জন
      </p>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[#25D366]" style={{ width: `${(sent.size * 100) / items.length}%` }} />
      </div>
      {next ? (
        <>
          <Button size="xl" className="mt-3 bg-[#25D366] hover:bg-[#25D366]/90" onClick={() => go(next)}>
            <Send className="size-5" /> পরের জন: {next.label}
          </Button>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            চাপলে WhatsApp খুলবে, মেসেজ তৈরি থাকবে — শুধু &quot;পাঠান&quot; চাপুন, তারপর এই পাতায় ফিরে আবার চাপুন।
            {next.hasPhone ? "" : " (এঁর নম্বর নেই — WhatsApp-এ কাকে পাঠাবেন বেছে নিন)"}
          </p>
        </>
      ) : (
        <p className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-green-50 p-2.5 text-base text-green-900">
          <Check className="size-5" /> সবাইকে পাঠানো হয়েছে
        </p>
      )}
    </div>
  )
}
