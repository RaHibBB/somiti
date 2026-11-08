"use client"

import { useEffect, useState, useTransition } from "react"
import { Bell, BellOff, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/forms/form-bits"
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestNotificationAction } from "@/app/(app)/notifications/actions"

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const DISMISS_KEY = "samiti-push-prompt-dismissed"

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function currentState(): Promise<State> {
  if (!PUBLIC_KEY) return "unsupported"
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // iPhone/iPad: push works only after "Add to Home Screen".
    return isIos() && !isStandalone() ? "ios-install" : "unsupported"
  }
  if (Notification.permission === "denied") return "denied"
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub && Notification.permission === "granted" ? "on" : "off"
}

/**
 * Turn push notifications on/off for this phone. `variant="prompt"` is the dismissable card on
 * the home page (hidden when already on, unsupported, or dismissed); `variant="settings"` is the
 * full control on the settings page.
 */
export function PushToggle({ variant = "settings" }: { variant?: "settings" | "prompt" }) {
  const [state, setState] = useState<State>("loading")
  const [error, setError] = useState<string>()
  const [info, setInfo] = useState<string>()
  const [pending, start] = useTransition()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    currentState()
      .catch((): State => "unsupported")
      .then((s) => {
        let wasDismissed = false
        try {
          wasDismissed = localStorage.getItem(DISMISS_KEY) === "1"
        } catch {}
        setDismissed(wasDismissed)
        setState(s)
      })
  }, [])

  function turnOn() {
    setError(undefined)
    setInfo(undefined)
    start(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off")
          return
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
        await navigator.serviceWorker.ready
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(PUBLIC_KEY) }))
        const res = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent)
        if (!res.ok) {
          setError(res.error)
          return
        }
        setState("on")
        setInfo("চালু হয়েছে। এখন থেকে সমিতির খবর এই ফোনে আসবে।")
      } catch {
        setError("নোটিফিকেশন চালু করা যায়নি। ব্রাউজার আপডেট করে আবার চেষ্টা করুন।")
      }
    })
  }

  function turnOff() {
    setError(undefined)
    setInfo(undefined)
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint)
        await sub.unsubscribe()
      }
      setState("off")
    })
  }

  function test() {
    setError(undefined)
    setInfo(undefined)
    start(async () => {
      const res = await sendTestNotificationAction()
      if (res.ok) setInfo("পরীক্ষার নোটিফিকেশন পাঠানো হয়েছে — কয়েক সেকেন্ডের মধ্যে আসবে।")
      else setError(res.error)
    })
  }

  if (variant === "prompt") {
    if (dismissed || state !== "off") return null
    return (
      <div className="relative rounded-2xl border-2 border-brand-navy/30 bg-white p-4 pr-10">
        <button
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full text-muted-foreground"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISS_KEY, "1")
            } catch {}
          }}
        >
          <X className="size-5" />
        </button>
        <p className="flex items-center gap-2 text-base font-semibold text-brand-navy">
          <Bell className="size-5" /> ফোনে নোটিফিকেশন চালু করুন
        </p>
        <p className="mt-1 text-sm text-muted-foreground">জমার রসিদ, চাঁদার তারিখ, নোটিশ আর ভোটের খবর ফোনে চলে আসবে।</p>
        <Button size="lg" className="mt-3 w-full" disabled={pending} onClick={turnOn}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Bell className="size-5" />} চালু করুন
        </Button>
        <FormError message={error} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {state === "loading" ? <p className="text-sm text-muted-foreground">দেখা হচ্ছে…</p> : null}
      {state === "unsupported" ? <p className="text-sm text-muted-foreground">এই ব্রাউজারে নোটিফিকেশন চলে না। ফোনে Chrome দিয়ে অ্যাপটি খুলুন।</p> : null}
      {state === "ios-install" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          iPhone-এ আগে অ্যাপটি হোম স্ক্রিনে যোগ করুন: Safari-র নিচের Share বোতাম → &quot;Add to Home Screen&quot;। তারপর হোম স্ক্রিনের আইকন থেকে খুলে এখানে চালু করুন।
        </p>
      ) : null}
      {state === "denied" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          এই ফোনে নোটিফিকেশন বন্ধ করা আছে। ব্রাউজারের ঠিকানার পাশের 🔒 চিহ্ন → Permissions/Notifications → Allow করুন, তারপর পাতাটি আবার খুলুন।
        </p>
      ) : null}
      {state === "off" ? (
        <Button size="lg" className="w-full" disabled={pending} onClick={turnOn}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Bell className="size-5" />} এই ফোনে নোটিফিকেশন চালু করুন
        </Button>
      ) : null}
      {state === "on" ? (
        <>
          <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-base text-green-900">
            <Bell className="size-5" /> এই ফোনে নোটিফিকেশন চালু আছে
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" disabled={pending} onClick={test}>
              পরীক্ষা পাঠান
            </Button>
            <Button variant="outline" size="lg" disabled={pending} onClick={turnOff}>
              <BellOff className="size-5" /> বন্ধ করুন
            </Button>
          </div>
        </>
      ) : null}
      {info ? <p className="text-sm text-green-800">{info}</p> : null}
      <FormError message={error} />
    </div>
  )
}
