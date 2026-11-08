"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

/** Copies a value (account or bKash number) so members can paste it into their bKash/bank app. */
export function CopyButton({ value, label = "কপি", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Older phones: fall back to a hidden textarea.
      const t = document.createElement("textarea")
      t.value = value
      document.body.appendChild(t)
      t.select()
      document.execCommand("copy")
      t.remove()
    }
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border bg-white px-3 text-sm font-medium active:bg-muted",
        done && "border-green-600 text-green-700",
        className,
      )}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "কপি হয়েছে" : label}
    </button>
  )
}
