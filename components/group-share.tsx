"use client"

import { useState } from "react"
import { Check, MessageCircle } from "lucide-react"
import { waLink } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"

/**
 * Send a prepared message to the samiti's WhatsApp group.
 *
 * WhatsApp has no link that posts straight into a group. When the group's invite link is
 * configured, this copies the message and opens the group chat itself (for someone already
 * in the group the invite link opens the chat), so the admin only has to paste and send.
 * Without the link it falls back to wa.me, where WhatsApp asks which chat to send to.
 */
export function GroupShare({
  text,
  groupUrl,
  label = "WhatsApp গ্রুপে পাঠান",
  className,
}: {
  text: string
  groupUrl: string | null
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const base = "flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-base font-semibold text-white active:opacity-90"

  if (!groupUrl) {
    return (
      <a href={waLink(null, text)} target="_blank" rel="noopener noreferrer" className={cn(base, className)}>
        <MessageCircle className="size-5" /> {label}
      </a>
    )
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement("textarea")
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand("copy")
      t.remove()
    }
    setCopied(true)
    window.open(groupUrl!, "_blank", "noopener")
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <button type="button" onClick={copyAndOpen} className={cn(base, "w-full")}>
        {copied ? <Check className="size-5" /> : <MessageCircle className="size-5" />} {label}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {copied
          ? "মেসেজ কপি হয়েছে। গ্রুপে লেখার ঘরে চেপে ধরে \"Paste\" করে পাঠান।"
          : "চাপলে মেসেজ কপি হবে আর সরাসরি গ্রুপ খুলবে — শুধু Paste করে পাঠান।"}
      </p>
      {copied ? (
        <a href={waLink(null, text)} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-brand-navy underline">
          গ্রুপ না খুললে: অন্যভাবে পাঠান
        </a>
      ) : null}
    </div>
  )
}
