// Pure helpers for login identifiers and passwords (unit-tested).
// (File name kept from the original PIN design; passwords are now any 6–64 characters,
// so existing 6-digit PINs keep working as passwords.)
import { fromBn } from "@/lib/format"

export const MAX_FAILED_LOGINS = 5
export const LOCK_MINUTES = 15
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 64 // bcrypt only uses the first 72 bytes

/** Normalise a Bangladeshi mobile number to 01XXXXXXXXX, or null if invalid. */
export function normalizePhone(input: string): string | null {
  let s = fromBn(input).replace(/[\s\-()]/g, "")
  if (s.startsWith("+")) s = s.slice(1)
  if (s.startsWith("880")) s = s.slice(2)
  else if (s.startsWith("88") && s.length === 13) s = s.slice(2)
  return /^01[3-9]\d{8}$/.test(s) ? s : null
}

/** Lower-cased email, or null if it doesn't look like one. */
export function normalizeEmail(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (s.length > 254) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null
}

export type LoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string }
  | { kind: "memberNo"; memberNo: number }

/** Accepts an email, a phone number or a member number (Bengali or ASCII digits). */
export function parseIdentifier(input: string): LoginIdentifier | null {
  const raw = input.trim()
  if (!raw) return null
  if (raw.includes("@")) {
    const email = normalizeEmail(raw)
    return email ? { kind: "email", email } : null
  }
  const s = fromBn(raw).replace(/[\s\-]/g, "")
  const phone = normalizePhone(s)
  if (phone) return { kind: "phone", phone }
  if (/^\d{1,4}$/.test(s)) {
    const n = Number(s)
    if (n > 0) return { kind: "memberNo", memberNo: n }
  }
  return null
}

/** Length check only; any characters are allowed. */
export function isValidPassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX
}

const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwerty", "qwerty123", "abc123", "abcdef", "iloveyou", "samiti", "samiti123", "bangladesh"])

/** Rejects trivially guessable passwords: one repeated character, straight digit runs, very common words. */
export function isWeakPassword(pw: string): boolean {
  const p = fromBn(pw).toLowerCase()
  if (/^(.)\1+$/.test(p)) return true
  if (/^\d+$/.test(p) && ("01234567890".includes(p) || "98765432109".includes(p))) return true
  return COMMON.has(p)
}

/** Random 6-digit temporary password (easy to read out to a member). */
export function generatePin(): string {
  for (;;) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const pin = String(buf[0] % 1_000_000).padStart(6, "0")
    if (!isWeakPassword(pin)) return pin
  }
}
