// Zod building blocks for server actions. Inputs may contain Bengali digits.
import { z } from "zod"
import { normalizeEmail, normalizePhone } from "@/lib/auth/pin"
import { fromBn } from "@/lib/format"

const str = z.string().transform((s) => fromBn(s).trim())

/** Optional text: empty → null. */
export const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : null))

export const reqText = (max = 500, msg = "এই ঘরটি পূরণ করুন।") => z.string().trim().min(1, msg).max(max)

/** Whole taka, > 0. Accepts "১,০০০" or "1000". */
export const takaAmount = str.pipe(
  z
    .string()
    .transform((s) => s.replace(/[,\s৳]/g, ""))
    .refine((s) => /^\d{1,9}$/.test(s), "টাকার পরিমাণ সঠিক নয় (শুধু পূর্ণ সংখ্যা)।")
    .transform(Number)
    .refine((n) => n > 0, "টাকার পরিমাণ শূন্যের বেশি হতে হবে।"),
)

export const intIn = (min: number, max: number, msg: string) =>
  str.pipe(
    z
      .string()
      .refine((s) => /^\d+$/.test(s), msg)
      .transform(Number)
      .refine((n) => n >= min && n <= max, msg),
  )

export const isoDate = str.pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ সঠিক নয়।"))
export const optIsoDate = z
  .string()
  .optional()
  .transform((s) => (s ? s.trim() : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ সঠিক নয়।").nullable())

/** "YYYY-MM" (from <input type=month>) or "YYYY-MM-01" → "YYYY-MM-01". */
export const monthKey = str.pipe(
  z
    .string()
    .regex(/^\d{4}-\d{2}(-01)?$/, "মাস সঠিক নয়।")
    .transform((s) => s.slice(0, 7) + "-01"),
)

/** Optional BD mobile; normalised to 01XXXXXXXXX. */
export const optPhone = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (!s || !s.trim()) return null
    const p = normalizePhone(s)
    if (!p) {
      ctx.addIssue({ code: "custom", message: "মোবাইল নম্বর সঠিক নয় (০১XXXXXXXXX)।" })
      return z.NEVER
    }
    return p
  })

/** Optional email; lower-cased. */
export const optEmail = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (!s || !s.trim()) return null
    const e = normalizeEmail(s)
    if (!e) {
      ctx.addIssue({ code: "custom", message: "ইমেইল ঠিকানা সঠিক নয়।" })
      return z.NEVER
    }
    return e
  })

export const idParam = z.coerce.number().int().positive()

/** First Bengali error message from a failed parse. */
export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "ফর্মে ভুল আছে।"
}

/** FormData → plain object of strings (first value per key). */
export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !(k in out)) out[k] = v
  return out
}
