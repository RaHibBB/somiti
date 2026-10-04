import Link from "next/link"
import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { ProposalBadge } from "@/components/proposal-badge"
import { getViewer } from "@/lib/auth/session"
import { showAdminUi } from "@/lib/auth/view"
import { getDb } from "@/lib/db"
import { members, proposals, transactions, votes } from "@/lib/db/schema"
import { formatDate, formatDateTime, taka, toBn } from "@/lib/format"
import { activeMemberCount, closeExpiredProposals, countVotes, myVote } from "@/lib/services/proposals"
import { quorumFor, tally } from "@/lib/voting"
import { CloseProposalForm, VoteForm } from "./vote-forms"

const OUTCOME_TEXT = {
  passed: "সক্রিয় সদস্যের অর্ধেকের বেশি ভোট দিয়েছেন এবং \"হ্যাঁ\" বেশি — প্রস্তাব পাস।",
  rejected: "ভোট বৈধ, কিন্তু \"না\" ভোট \"হ্যাঁ\"-এর সমান বা বেশি — প্রস্তাব পাস হয়নি।",
  invalid: "সক্রিয় সদস্যের অর্ধেক বা তার কম ভোট দিয়েছেন — ভোট অবৈধ।",
} as const

export default async function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const me = await getViewer()
  const adminUi = await showAdminUi(me)
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const db = getDb()
  await closeExpiredProposals(db)
  const [p] = await db.select().from(proposals).where(eq(proposals.id, id))
  if (!p) notFound()

  const [mine, counts, active, voters, linked] = await Promise.all([
    me ? myVote(db, id, me.id) : Promise.resolve(null),
    countVotes(db, id),
    activeMemberCount(db),
    db
      .select({ no: members.memberNo, name: members.nameBn })
      .from(votes)
      .innerJoin(members, eq(members.id, votes.memberId))
      .where(eq(votes.proposalId, id))
      .orderBy(asc(members.memberNo)),
    db.select().from(transactions).where(eq(transactions.proposalId, id)),
  ])
  const isOpen = p.status === "open"
  const voted = counts.yes + counts.no
  const needed = quorumFor(isOpen ? active : (p.activeMembersAtClose ?? active))
  const final = !isOpen && p.status !== "draft" ? tally(p.yesCount ?? 0, p.noCount ?? 0, p.activeMembersAtClose ?? 0) : null

  return (
    <div className="space-y-4">
      <PageTitle>প্রস্তাব</PageTitle>
      <article className="space-y-2 rounded-xl border bg-white p-4">
        <ProposalBadge status={p.status} />
        <h2 className="text-xl font-bold">{p.title}</h2>
        {p.amount ? <p className="text-lg font-semibold text-brand-navy">পরিমাণ: {taka(p.amount)}</p> : null}
        <p className="text-base whitespace-pre-line">{p.description}</p>
        <p className="text-sm text-muted-foreground">
          {isOpen && p.closesAt ? `ভোট শেষ: ${formatDateTime(p.closesAt)}` : p.closedAt ? `ভোট বন্ধ হয়েছে: ${formatDateTime(p.closedAt)}` : ""}
        </p>
      </article>

      {isOpen ? (
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <div>
            <p className="text-base">
              ভোট দিয়েছেন <b>{toBn(voted)}</b> / {toBn(active)} জন · বৈধ হতে দরকার <b>{toBn(needed)}</b> জন
            </p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-brand-navy" style={{ width: `${active ? Math.min(100, (voted * 100) / active) : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">ভোট চলাকালে কে কোন দিকে ভোট দিচ্ছেন বা হ্যাঁ/না সংখ্যা দেখানো হয় না।</p>
          </div>
          {mine ? (
            <p className="rounded-lg bg-green-50 p-3 text-base text-green-800">
              ✓ আপনি &quot;{mine.choice === "yes" ? "হ্যাঁ" : "না"}&quot; ভোট দিয়েছেন ({formatDateTime(mine.createdAt)})।
            </p>
          ) : !me ? (
            <Link
              href={`/login?next=/proposals/${p.id}`}
              className="block rounded-xl bg-primary py-3 text-center text-base font-semibold text-white"
            >
              ভোট দিতে লগইন করুন
            </Link>
          ) : me.status === "active" ? (
            <VoteForm proposalId={p.id} />
          ) : null}
          {adminUi ? <CloseProposalForm proposalId={p.id} /> : null}
        </section>
      ) : final ? (
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <h3 className="text-lg font-semibold text-brand-navy">ফলাফল</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-green-50 p-2">
              <p className="text-sm text-green-800">হ্যাঁ</p>
              <p className="text-2xl font-bold text-green-800">{toBn(final.yes)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2">
              <p className="text-sm text-red-800">না</p>
              <p className="text-2xl font-bold text-red-800">{toBn(final.no)}</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-sm">ভোট দেননি</p>
              <p className="text-2xl font-bold">{toBn(Math.max(0, final.activeMembers - final.voted))}</p>
            </div>
          </div>
          <p className="text-base">
            মোট সক্রিয় সদস্য {toBn(final.activeMembers)} জন · ভোট দিয়েছেন {toBn(final.voted)} জন (দরকার ছিল {toBn(final.quorum)})
          </p>
          <p className="rounded-lg bg-secondary p-3 text-base">{OUTCOME_TEXT[final.outcome]}</p>
          {mine ? <p className="text-sm text-muted-foreground">আপনার ভোট: {mine.choice === "yes" ? "হ্যাঁ" : "না"}</p> : null}
        </section>
      ) : null}

      {linked.length ? (
        <section className="space-y-2 rounded-xl border bg-white p-4">
          <h3 className="text-base font-semibold">এই প্রস্তাবের লেনদেন</h3>
          {linked.map((t) => (
            <p key={t.id} className={t.status === "void" ? "text-muted-foreground line-through" : ""}>
              {formatDate(t.date)} · {taka(t.amount)} · {t.description}
            </p>
          ))}
        </section>
      ) : null}

      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-base">কারা ভোট দিয়েছেন ({toBn(voters.length)})</summary>
        <p className="mt-2 text-sm text-muted-foreground">শুধু নাম দেখানো হয়; কে কোন দিকে ভোট দিয়েছেন তা গোপন।</p>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
          {voters.map((v) => (
            <li key={v.no}>
              {toBn(v.no)}. {v.name}
            </li>
          ))}
        </ul>
      </details>

      <Link href="/proposals" className="block py-2 text-center text-base text-brand-navy">
        ← সব প্রস্তাব
      </Link>
    </div>
  )
}
