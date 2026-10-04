import "server-only"
import { cookies } from "next/headers"
import type { Member } from "@/lib/db/schema"

// Display preference only: an admin can switch the app to "member view" to see exactly
// what members see (their own account, no admin buttons). It never grants or removes
// permissions — admin pages and actions still check the real role in the database.
export const VIEW_COOKIE = "samiti_view"

export type ViewMode = "admin" | "member"

export async function viewMode(me: Pick<Member, "role">): Promise<ViewMode> {
  if (me.role !== "admin") return "member"
  return (await cookies()).get(VIEW_COOKIE)?.value === "member" ? "member" : "admin"
}

/** Show admin buttons/sections? (admin role AND admin view selected) */
export async function showAdminUi(me: Pick<Member, "role">): Promise<boolean> {
  return (await viewMode(me)) === "admin"
}
