// Signed session token (no DB access) — shared by proxy.ts and the server session helpers.
import { jwtVerify, SignJWT } from "jose"

export const SESSION_COOKIE = "samiti_session"
// Members stay logged in "permanently" (samiti decision): the cookie lasts 400 days — the longest
// browsers allow — and proxy.ts re-issues it on every visit after RENEW_AFTER, so an account that is
// used at all never expires. Logging out, a password change or an admin reset still ends it at once
// (session_version is checked against the DB on every request).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 400
export const RENEW_AFTER = 60 * 60 * 24 * 7 // re-issue the cookie once it is a week old

export type SessionPayload = {
  memberId: number
  role: "member" | "admin"
  sv: number // session_version
  /** Issued-at (seconds); present on verified tokens. */
  iat?: number
}

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)")
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.memberId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key())
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] })
    const memberId = Number(payload.sub)
    const role = payload.role
    const sv = payload.sv
    if (!Number.isInteger(memberId) || (role !== "member" && role !== "admin") || typeof sv !== "number") return null
    return { memberId, role, sv, iat: typeof payload.iat === "number" ? payload.iat : undefined }
  } catch {
    return null
  }
}
