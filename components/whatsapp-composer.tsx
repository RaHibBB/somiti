"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { waLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"

export type WaTemplate = { label: string; text: string }

/**
 * Admin tool: pick a ready-made message (or write one), edit it, and open WhatsApp with it.
 * Free — uses a wa.me link, no API. Without a phone number WhatsApp asks whom to send it to.
 */
export function WhatsAppComposer({ phone, templates }: { phone: string | null; templates: WaTemplate[] }) {
  const [picked, setPicked] = useState(0)
  const [text, setText] = useState(templates[0]?.text ?? "")

  function choose(i: number) {
    setPicked(i)
    setText(templates[i].text)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {templates.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => choose(i)}
            aria-pressed={picked === i}
            className={cn(
              "h-10 rounded-full border-2 px-3 text-sm",
              picked === i ? "border-[#128C7E] bg-[#128C7E] font-semibold text-white" : "bg-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="text-base" aria-label="মেসেজ" />
      <a
        href={waLink(phone, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!text.trim()}
        className={cn(
          "flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white active:opacity-90",
          !text.trim() && "pointer-events-none opacity-50",
        )}
      >
        <MessageCircle className="size-5" /> WhatsApp-এ পাঠান
      </a>
      {!phone ? (
        <p className="text-sm text-muted-foreground">এই সদস্যের মোবাইল নম্বর নেই — WhatsApp খুললে কাকে পাঠাবেন বেছে নিন।</p>
      ) : null}
    </div>
  )
}
