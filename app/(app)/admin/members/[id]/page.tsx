import Link from "next/link"
import { notFound } from "next/navigation"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { formatDate, formatDateTime, monthLabel, taka, toBn } from "@/lib/format"
import { addMonths, monthOf } from "@/lib/ledger"
import { CancelMemberForm, EditMemberForm, ResetPinForm, SharesForm } from "../member-forms"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
      {children}
    </section>
  )
}

export default async function AdminMemberPage({ params }: PageProps<"/admin/members/[id]">) {
  const me = await requireAdmin()
  const id = Number((await params).id)
  const snap = await getSnapshot()
  const entry = snap.members.find((m) => m.member.id === id)
  if (!entry) notFound()
  const m = entry.member
  const sortedHistory = [...entry.history].sort((a, b) =>
    a.effectiveMonth === b.effectiveMonth ? b.id - a.id : b.effectiveMonth.localeCompare(a.effectiveMonth),
  )
  return (
    <div className="space-y-4">
      <PageTitle>
        {toBn(m.memberNo)}. {m.nameBn}
      </PageTitle>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border bg-white p-2">
          <p className="text-xs text-muted-foreground">শেয়ার</p>
          <p className="text-lg font-semibold">{toBn(entry.sharesNow)}</p>
        </div>
        <div className="rounded-xl border bg-white p-2">
          <p className="text-xs text-muted-foreground">মোট জমা</p>
          <p className="text-lg font-semibold">{taka(entry.paid)}</p>
        </div>
        <div className="rounded-xl border bg-white p-2">
          <p className="text-xs text-muted-foreground">বকেয়া</p>
          <p className={entry.due > 0 ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>{taka(entry.due)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={`/members/${m.id}`} className="flex h-11 flex-1 items-center justify-center rounded-lg border bg-white text-base">
          হিসাব দেখুন
        </Link>
        {m.status === "active" ? (
          <Link href={`/admin/pay?member=${m.id}`} className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-base text-white">
            জমা নিন
          </Link>
        ) : null}
      </div>

      {m.status === "cancelled" ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-base text-destructive">
          সদস্যপদ বাতিল — {m.cancelledAt ? formatDateTime(m.cancelledAt) : ""}
          {m.cancelReason ? ` · কারণ: ${m.cancelReason}` : ""}
        </p>
      ) : null}

      <Section title="তথ্য">
        <EditMemberForm
          defaults={{
            id: m.id,
            memberNo: m.memberNo,
            nameBn: m.nameBn,
            phone: m.phone,
            email: m.email,
            role: m.role,
            joinedOn: m.joinedOn,
            nomineeName: m.nomineeName,
            nomineePhone: m.nomineePhone,
            notes: m.notes,
          }}
        />
      </Section>

      <Section title="শেয়ার">
        <ul className="space-y-1 text-base">
          {sortedHistory.map((h) => (
            <li key={h.id}>
              {monthLabel(h.effectiveMonth)} থেকে: <b>{toBn(h.shares)} শেয়ার</b> (মাসে {taka(h.shares * snap.settings.sharePrice)})
            </li>
          ))}
        </ul>
        <SharesForm id={m.id} current={entry.sharesNow} defaultMonth={addMonths(monthOf(snap.today), 1)} />
      </Section>

      {m.status === "active" ? (
        <>
          <Section title="পাসওয়ার্ড রিসেট">
            <p className="text-sm text-muted-foreground">
              {m.lockedUntil && m.lockedUntil > new Date()
                ? `ভুল পাসওয়ার্ডের কারণে অ্যাকাউন্ট বন্ধ আছে। রিসেট করলে খুলে যাবে।`
                : m.mustChangePin
                  ? "সদস্য এখনো নিজের পাসওয়ার্ড সেট করেননি।"
                  : `যোগদান: ${formatDate(m.joinedOn)}`}
            </p>
            <ResetPinForm id={m.id} name={m.nameBn} />
          </Section>
          {m.id !== me.id ? (
            <Section title="সদস্যপদ বাতিল">
              <CancelMemberForm id={m.id} name={m.nameBn} />
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
