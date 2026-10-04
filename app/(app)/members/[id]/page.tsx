import Link from "next/link"
import { notFound } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { PageTitle } from "@/components/layout/page-title"
import { MemberStatement } from "@/components/member-statement"
import { WhatsAppComposer, type WaTemplate } from "@/components/whatsapp-composer"
import { appUrl } from "@/lib/app-url"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { getSnapshot } from "@/lib/data"
import { toBn } from "@/lib/format"
import { overdueMonths } from "@/lib/ledger"
import { accountSummaryMessage, reminderMessage, SAMITI_NAME } from "@/lib/whatsapp"

export default async function MemberAccountPage({ params }: PageProps<"/members/[id]">) {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const id = Number((await params).id)
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.member.id === id)
  if (!entry) notFound()
  const m = entry.member

  // WhatsApp templates (admins only — they're the ones who see phone numbers).
  let templates: WaTemplate[] = []
  if (adminUi) {
    const overdue = overdueMonths(entry.lines).map((l) => l.month)
    const summary = accountSummaryMessage({
      name: m.nameBn,
      memberNo: m.memberNo,
      shares: entry.sharesNow,
      sharePrice: snap.settings.sharePrice,
      paid: entry.paid,
      due: entry.due,
      overdueMonths: overdue,
      accountUrl: `${await appUrl()}/members/${m.id}`,
    })
    templates = [
      { label: "হিসাবের সারাংশ", text: summary },
      ...(entry.due > 0
        ? [{ label: "বকেয়ার রিমাইন্ডার", text: reminderMessage({ name: m.nameBn, due: entry.due, months: overdue, dueDay: snap.settings.dueDay }) }]
        : []),
      { label: "নিজে লিখুন", text: `আসসালামু আলাইকুম, ${m.nameBn}।\n\n\n— ${SAMITI_NAME}` },
    ]
  }

  return (
    <>
      <PageTitle
        action={
          adminUi ? (
            <div className="flex gap-2">
              {m.status === "active" ? (
                <Link href={`/admin/pay?member=${m.id}`} className="flex h-10 items-center rounded-lg bg-brand-green px-3 text-sm font-semibold text-white">
                  জমা নিন
                </Link>
              ) : null}
              <Link href={`/admin/members/${m.id}`} className="flex h-10 items-center rounded-lg border bg-white px-3 text-sm">
                সম্পাদনা
              </Link>
            </div>
          ) : null
        }
      >
        {toBn(m.memberNo)}. {m.nameBn}
      </PageTitle>
      {m.status === "cancelled" ? (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-base text-destructive">এই সদস্যপদ বাতিল করা হয়েছে।</p>
      ) : null}

      {adminUi ? (
        <details className="mb-5 rounded-xl border-2 border-[#25D366] bg-white p-3">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-base font-semibold text-[#128C7E]">
            <MessageCircle className="size-5" /> {m.nameBn}-কে WhatsApp-এ মেসেজ
          </summary>
          <div className="pt-3">
            <WhatsAppComposer phone={m.phone} templates={templates} />
          </div>
        </details>
      ) : null}

      <MemberStatement entry={entry} sharePrice={snap.settings.sharePrice} />
    </>
  )
}
