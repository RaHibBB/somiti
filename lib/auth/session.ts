import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { members, type Member } from "@/lib/db/schema"
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./token"

/**
 * The logged-in member, re-checked against the database on every request:
 * the member must exist, be active, and the cookie's session_version must match.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const payload = await verifySession(token)
  if (!payload) return null
  const [member] = await getDb().select().from(members).where(eq(members.id, payload.memberId)).limit(1)
  if (!member || member.status !== "active" || member.sessionVersion !== payload.sv) return null
  return member
})

/**
 * For public pages: the logged-in member, or null for a visitor. Everyone may read the accounts
 * without logging in (samiti decision); logging in is only needed to write something.
 * A member who still has to change their starting password is sent there first.
 */
export async function getViewer(): Promise<Member | null> {
  const member = await getCurrentMember()
  if (member?.mustChangePin) redirect("/settings/pin")
  return member
}

/** For pages and server actions: any logged-in member. Forces a PIN change first if required. */
export async function requireMember(opts: { allowPinChange?: boolean } = {}): Promise<Member> {
  const member = await getCurrentMember()
  if (!member) redirect("/login")
  if (member.mustChangePin && !opts.allowPinChange) redirect("/settings/pin")
  return member
}

/** For admin pages and every admin server action. Role comes from the DB, not the cookie. */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember()
  if (member.role !== "admin") redirect("/")
  return member
}

export async function setSessionCookie(member: Pick<Member, "id" | "role" | "sessionVersion">) {
  const token = await signSession({ memberId: member.id, role: member.role, sv: member.sessionVersion })
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie() {
  ;(await cookies()).delete(SESSION_COOKIE)
}
