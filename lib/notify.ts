import "server-only"
import { after } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import type { DB } from "@/lib/db"
import { getDb } from "@/lib/db"
import { members, notifications, pushSubscriptions, type Notification } from "@/lib/db/schema"
import type { NotifyKind } from "@/lib/notify-kinds"

export type NewNotification = {
  memberId: number
  kind: NotifyKind
  title: string
  body: string
  url?: string | null
  /** Same key twice = sent once (daily reminders). */
  dedupeKey?: string | null
  /** Deliver even if the member turned this kind off (only for the "send a test" button). */
  force?: boolean
}

/**
 * Store notifications in the inbox (respecting each member's opt-outs; active members only)
 * and push them to their phones. Returns what was actually stored.
 */
export async function notify(db: DB, items: NewNotification[]): Promise<Notification[]> {
  if (items.length === 0) return []
  const ids = [...new Set(items.map((i) => i.memberId))]
  const people = await db.select({ id: members.id, status: members.status, notifyOff: members.notifyOff }).from(members).where(inArray(members.id, ids))
  const allowed = new Map(people.filter((p) => p.status === "active").map((p) => [p.id, new Set(p.notifyOff)]))
  const rows = items.filter((i) => allowed.get(i.memberId) && (i.force || !allowed.get(i.memberId)!.has(i.kind)))
  if (rows.length === 0) return []
  const stored = await db
    .insert(notifications)
    .values(rows.map((r) => ({ memberId: r.memberId, kind: r.kind, title: r.title, body: r.body, url: r.url ?? null, dedupeKey: r.dedupeKey ?? null })))
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning()
  await sendPush(db, stored)
  return stored
}

/** Run after the response is sent, so saving a payment never waits on push services. */
export function notifyLater(build: (db: DB) => Promise<NewNotification[]>) {
  after(async () => {
    try {
      const db = getDb()
      await notify(db, await build(db))
    } catch (err) {
      console.error("notify failed", err)
    }
  })
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/** Web Push to every device of each recipient. Dead subscriptions (404/410) are removed. */
async function sendPush(db: DB, items: Notification[]) {
  if (items.length === 0 || !pushConfigured()) return
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.memberId, [...new Set(items.map((i) => i.memberId))]))
  if (subs.length === 0) return
  // Loaded lazily: only needed when something is actually pushed.
  // web-push is CommonJS: depending on the bundler the API is on `default` or on the module itself.
  const mod = (await import("web-push")) as unknown as typeof import("web-push") & { default?: typeof import("web-push") }
  const webpush = mod.default ?? mod
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://somiti-psi.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  const dead: number[] = []
  await Promise.all(
    items.flatMap((n) =>
      subs
        .filter((s) => s.memberId === n.memberId)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/notifications", tag: `${n.kind}-${n.id}` }),
              { TTL: 60 * 60 * 24 * 3, urgency: n.kind === "admin" || n.kind === "payment" ? "high" : "normal" },
            )
          } catch (err) {
            const code = (err as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) dead.push(s.id)
            else console.error("push failed", code, (err as Error).message)
          }
        }),
    ),
  )
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead))
}

/** Active admins' ids (for admin notifications). */
export async function adminIds(db: DB): Promise<number[]> {
  const rows = await db.select({ id: members.id }).from(members).where(and(eq(members.role, "admin"), eq(members.status, "active")))
  return rows.map((r) => r.id)
}

/** Every active member's id (notices, votes). */
export async function activeMemberIds(db: DB): Promise<number[]> {
  const rows = await db.select({ id: members.id }).from(members).where(eq(members.status, "active"))
  return rows.map((r) => r.id)
}
