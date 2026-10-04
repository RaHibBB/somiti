import "server-only"
import { after } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/session"
import type { Member } from "@/lib/db/schema"
import { UserError } from "@/lib/services/errors"
import { firstError } from "@/lib/validation"
import { flushSheetOutbox } from "@/lib/sheets/sync"

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Wraps every admin server action: re-checks the session + admin role on the server,
 * turns UserError/ZodError into a Bengali message, and after a successful write pushes
 * the sheet outbox in the background (never blocks the response).
 */
export async function adminAction<T>(fn: (admin: Member) => Promise<T>): Promise<ActionResult<T>> {
  const admin = await requireAdmin() // redirects when not allowed — must stay outside try
  try {
    const data = await fn(admin)
    after(() => flushSheetOutbox().catch((e) => console.error("sheet sync failed", e)))
    return { ok: true, data }
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message }
    if (err instanceof z.ZodError) return { ok: false, error: firstError(err) }
    console.error(err)
    return { ok: false, error: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।" }
  }
}
