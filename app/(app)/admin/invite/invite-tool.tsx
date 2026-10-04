"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Check, Download, Loader2, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/forms/form-bits"
import { toBn } from "@/lib/format"
import { inviteMessage, waLink } from "@/lib/whatsapp"
import type { Invite, InviteCandidate } from "@/lib/services/invites"
import { cn } from "@/lib/utils"
import { createInvitesAction } from "./actions"

export function InviteTool({ candidates, activeCount }: { candidates: InviteCandidate[]; activeCount: number }) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(candidates.map((c) => c.id)))
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [sent, setSent] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [pending, start] = useTransition()

  const nextToSend = invites?.find((i) => !sent.has(i.id)) ?? null
  const allSent = invites !== null && invites.length > 0 && !nextToSend

  // The passwords live only in this page: warn before leaving with some still unsent.
  useEffect(() => {
    if (!invites || allSent) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [invites, allSent])

  const linkFor = (i: Invite) =>
    waLink(
      i.phone,
      inviteMessage({ name: i.name, memberNo: i.no, phone: i.phone, pin: i.pin, loginUrl: `${window.location.origin}/login` }),
    )

  function generate() {
    if (picked.size === 0) return setError("অন্তত একজন সদস্য বাছাই করুন।")
    if (
      !confirm(
        `${toBn(picked.size)} জনের জন্য নতুন অস্থায়ী পাসওয়ার্ড তৈরি হবে। এঁদের আগে দেওয়া অস্থায়ী পাসওয়ার্ড আর কাজ করবে না। এগোবেন?`,
      )
    )
      return
    setError(undefined)
    start(async () => {
      const res = await createInvitesAction({ memberIds: [...picked] })
      if (!res.ok) return setError(res.error)
      setInvites(res.data.invites)
      setSent(new Set())
      if (res.data.skipped > 0)
        setNotice(`${toBn(res.data.skipped)} জনকে বাদ দেওয়া হয়েছে (তাঁরা এর মধ্যে নিজের পাসওয়ার্ড দিয়ে ফেলেছেন বা সদস্যপদ বাতিল)।`)
    })
  }

  function send(i: Invite) {
    window.open(linkFor(i), "_blank", "noopener")
    setSent((prev) => new Set(prev).add(i.id))
  }

  const csv = useMemo(() => {
    if (!invites) return ""
    const rows = [
      ["সদস্য নং", "নাম", "মোবাইল", "অস্থায়ী পাসওয়ার্ড"],
      ...invites.map((i) => [String(i.no), i.name, i.phone ?? "", i.pin]),
    ]
    return "﻿" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n")
  }, [invites])

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "login-details.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Step 2: send one by one ──
  if (invites) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <b>এই পাতা ছেড়ে গেলে পাসওয়ার্ড আর দেখা যাবে না</b> (অ্যাপ কোথাও পাসওয়ার্ড সাজিয়ে রাখে না)। বাকি থাকলে সদস্যের পাতা থেকে নতুন তৈরি করতে হবে।
        </div>
        {notice ? <p className="rounded-xl bg-muted p-3 text-sm">{notice}</p> : null}

        <div className="rounded-2xl border bg-white p-4">
          <p className="text-base">
            পাঠানো হয়েছে <b>{toBn(sent.size)}</b> / {toBn(invites.length)} জন
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-[#25D366]" style={{ width: `${invites.length ? (sent.size * 100) / invites.length : 0}%` }} />
          </div>
          {allSent ? (
            <p className="mt-3 rounded-lg bg-green-50 p-3 text-center text-base text-green-900">✓ সবাইকে পাঠানো হয়েছে।</p>
          ) : nextToSend ? (
            <>
              <Button size="xl" className="mt-3 h-16 bg-[#25D366] text-lg hover:bg-[#25D366]/90" onClick={() => send(nextToSend)}>
                <Send className="size-6" /> পরের জন: {toBn(nextToSend.no)}. {nextToSend.name}
              </Button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                চাপলে WhatsApp খুলবে — মেসেজ তৈরি থাকবে, শুধু &quot;পাঠান&quot; চাপুন। তারপর এই পাতায় ফিরে এসে আবার চাপুন।
                {nextToSend.phone ? "" : " (এঁর মোবাইল নম্বর নেই — WhatsApp-এ কাকে পাঠাবেন বেছে নিন)"}
              </p>
            </>
          ) : null}
        </div>

        <ul className="divide-y overflow-hidden rounded-xl border bg-white">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 shrink-0 text-center text-sm font-semibold text-brand-navy">{toBn(i.no)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{i.name}</span>
                <span className="block text-xs text-muted-foreground">{i.phone ? toBn(i.phone) : "মোবাইল নেই"}</span>
              </span>
              {sent.has(i.id) ? <Check className="size-5 text-green-600" aria-label="পাঠানো হয়েছে" /> : null}
              <button
                type="button"
                onClick={() => send(i)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold",
                  sent.has(i.id) ? "border bg-white text-muted-foreground" : "bg-[#25D366] text-white",
                )}
              >
                <MessageCircle className="size-4" /> {sent.has(i.id) ? "আবার" : "পাঠান"}
              </button>
            </li>
          ))}
        </ul>

        <Button variant="outline" size="lg" className="w-full" onClick={downloadCsv}>
          <Download className="size-5" /> তালিকা ডাউনলোড (ব্যাকআপ হিসেবে)
        </Button>
      </div>
    )
  }

  // ── Step 1: choose who ──
  const allPicked = candidates.length > 0 && candidates.every((c) => picked.has(c.id))
  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed text-muted-foreground">
        যাঁরা এখনো নিজের পাসওয়ার্ড দেননি, তাঁদের জন্য নতুন অস্থায়ী পাসওয়ার্ড তৈরি হবে। তারপর একে একে WhatsApp-এ পাঠাতে পারবেন। যাঁরা নিজের পাসওয়ার্ড দিয়ে ফেলেছেন ({toBn(activeCount - candidates.length)} জন), তাঁদের পাসওয়ার্ড <b>বদলাবে না</b>।
      </p>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
        আগেই কাউকে পাসওয়ার্ড দিয়ে থাকলে তাঁর টিক তুলে দিন, নইলে ওই পাসওয়ার্ড আর কাজ করবে না।
      </p>

      {candidates.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-4 text-center text-base text-green-900">সবাই নিজের পাসওয়ার্ড দিয়ে ফেলেছেন। পাঠানোর কিছু নেই।</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-base">
              বাছাই <b>{toBn(picked.size)}</b> / {toBn(candidates.length)} জন
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setPicked(allPicked ? new Set() : new Set(candidates.map((c) => c.id)))}>
              {allPicked ? "সব বাদ" : "সবাই"}
            </Button>
          </div>
          <ul className="divide-y overflow-hidden rounded-xl border bg-white">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2", picked.has(c.id) && "bg-green-50")}>
                  <input
                    type="checkbox"
                    className="size-6 shrink-0 accent-green-700"
                    checked={picked.has(c.id)}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) next.delete(c.id)
                        else next.add(c.id)
                        return next
                      })
                    }
                  />
                  <span className="w-8 shrink-0 text-center text-sm font-semibold text-brand-navy">{toBn(c.no)}</span>
                  <span className="min-w-0 flex-1 truncate text-base">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.phone ? toBn(c.phone) : "মোবাইল নেই"}</span>
                </label>
              </li>
            ))}
          </ul>
          <FormError message={error} />
          <div className="sticky bottom-20 z-10 lg:bottom-4">
            <Button size="xl" className="shadow-lg" onClick={generate} disabled={pending || picked.size === 0}>
              {pending ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> তৈরি হচ্ছে… (একটু সময় লাগবে)
                </>
              ) : (
                <>{toBn(picked.size)} জনের লগইন তথ্য তৈরি করুন</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
