"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requireMember } from "./session"
import { VIEW_COOKIE } from "./view"

/** Switch between admin view and member view (admins only; members are always in member view). */
export async function setViewAction(formData: FormData) {
  const me = await requireMember()
  const mode = formData.get("mode") === "member" ? "member" : "admin"
  const store = await cookies()
  if (me.role !== "admin" || mode === "admin") store.delete(VIEW_COOKIE)
  else store.set(VIEW_COOKIE, "member", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: true })
  redirect(mode === "member" ? "/me" : "/")
}
