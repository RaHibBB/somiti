// Signed session token (no DB access) — shared by proxy.ts and the server session helpers.
import { jwtVerify, SignJWT } from "jose"

export const SESSION_COOKIE = "samiti_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type SessionPayload = {
  memberId: number
  role: "member" | "admin"
  sv: number // session_version
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
    return { memberId, role, sv }
  } catch {
    return null
  }
}
