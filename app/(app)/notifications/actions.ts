"use server"

import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { requireMember } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { members, notifications, pushSubscriptions } from "@/lib/db/schema"
import { notify, pushConfigured } from "@/lib/notify"
import { NOTIFY_KINDS, NOTIFY_KIND_KEYS, isNotifyKind } from "@/lib/notify-kinds"

type Result = { ok: true } | { ok: false; error: string }

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(4).max(100) }),
})

/** Save this phone/browser's push subscription for the logged-in member. */
export async function savePushSubscriptionAction(input: unknown, userAgent: string): Promise<Result> {
  const me = await requireMember()
  const parsed = subSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "নোটিফিকেশন চালু করা যায়নি। আবার চেষ্টা করুন।" }
  const { endpoint, keys } = parsed.data
  const db = getDb()
  // One device = one row; if someone else used this phone before, it now belongs to this member.
  await db
    .insert(pushSubscriptions)
    .values({ memberId: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { memberId: me.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent.slice(0, 300) } })
  return { ok: true }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<Result> {
  const me = await requireMember()
  await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, String(endpoint).slice(0, 1000)), eq(pushSubscriptions.memberId, me.id)))
  return { ok: true }
}

/** A test notification to the member's own devices. */
export async function sendTestNotificationAction(): Promise<Result> {
  const me = await requireMember()
  if (!pushConfigured()) return { ok: false, error: "সার্ভারে নোটিফিকেশন এখনো চালু হয়নি।" }
  await notify(getDb(), [
    { memberId: me.id, kind: "notice", title: "পরীক্ষা: নোটিফিকেশন কাজ করছে ✓", body: "সমিতির খবর এভাবে আপনার ফোনে আসবে।", url: "/notifications", force: true },
  ])
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Which kinds of notifications the member wants (unticked = off). */
export async function saveNotifyPrefsAction(_: Result | undefined, fd: FormData): Promise<Result> {
  const me = await requireMember()
  const wanted = new Set(fd.getAll("kind").map(String).filter(isNotifyKind))
  const visible = NOTIFY_KIND_KEYS.filter((k) => !NOTIFY_KINDS[k].admin || me.role === "admin")
  const off = visible.filter((k) => !wanted.has(k))
  await getDb().update(members).set({ notifyOff: off }).where(eq(members.id, me.id))
  revalidatePath("/settings/pin")
  return { ok: true }
}

export async function markAllReadAction(): Promise<Result> {
  const me = await requireMember()
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.memberId, me.id), isNull(notifications.readAt)))
  revalidatePath("/", "layout")
  return { ok: true }
}
