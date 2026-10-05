"use client"

import { useEffect, useState } from "react"
import { Share, Smartphone, X } from "lucide-react"

type InstallEvent = Event & { prompt: () => Promise<void> }
const KEY = "samiti_install_hint"

/** One-time card suggesting "add to home screen"; hidden once installed or dismissed. */
export function InstallHint() {
  const [state, setState] = useState<"hidden" | "android" | "ios" | "other">("hidden")
  const [evt, setEvt] = useState<InstallEvent | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    if (standalone || !mobile) return
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    // Defer so the state update isn't synchronous inside the effect body.
    const t = setTimeout(() => setState(ios ? "ios" : "other"), 0)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as InstallEvent)
      setState("android")
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => {
      clearTimeout(t)
      window.removeEventListener("beforeinstallprompt", onPrompt)
    }
  }, [])

  if (state === "hidden") return null
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1")
    } catch {}
    setState("hidden")
  }

  return (
    <div className="relative rounded-2xl border border-brand-navy/20 bg-secondary p-3 pr-10 lg:col-span-2">
      <button type="button" onClick={dismiss} aria-label="বন্ধ করুন" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full active:bg-black/10">
        <X className="size-5" />
      </button>
      <p className="flex items-center gap-2 text-base font-semibold text-brand-navy">
        <Smartphone className="size-5" /> ফোনে অ্যাপের মতো রাখুন
      </p>
      {state === "android" && evt ? (
        <button
          type="button"
          onClick={async () => {
            await evt.prompt()
            dismiss()
          }}
          className="mt-2 h-11 rounded-lg bg-primary px-4 text-base font-medium text-white"
        >
          হোম স্ক্রিনে যোগ করুন
        </button>
      ) : state === "ios" ? (
        <p className="mt-1 text-sm leading-relaxed">
          Safari-র নিচের <Share className="inline size-4" /> (শেয়ার) চাপুন → <b>&quot;Add to Home Screen&quot;</b> চাপুন।
        </p>
      ) : (
        <p className="mt-1 text-sm leading-relaxed">
          ব্রাউজারের ⋮ মেনু চাপুন → <b>&quot;হোম স্ক্রিনে যোগ করুন&quot;</b> (Add to Home screen) চাপুন।
        </p>
      )}
    </div>
  )
}
