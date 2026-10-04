import { redirect } from "next/navigation"
import { requireMember } from "@/lib/auth/session"
import { todayDhaka } from "@/lib/format"

/** /print/month → this month's report. */
export default async function CurrentMonthReport() {
  await requireMember()
  redirect(`/print/month/${todayDhaka().slice(0, 7)}`)
}
