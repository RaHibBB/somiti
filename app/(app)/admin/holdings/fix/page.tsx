import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getSnapshot } from "@/lib/data"
import { FixReceivers, type FixRow } from "./fix-receivers"

export const metadata = { title: "কার কাছে টাকা — সংশোধন — সমিতি" }

export default async function FixHoldingsPage() {
  await requireAdmin()
  const snap = await getSnapshot()
  const names = new Map(snap.members.map((m) => [m.member.id, m.member.nameBn]))
  const rows: FixRow[] = snap.members
    .flatMap((m) =>
      m.payments
        .filter((p) => p.status === "valid")
        .map((p) => ({
          id: p.id,
          receiptNo: p.receiptNo,
          memberNo: m.member.memberNo,
          memberName: m.member.nameBn,
          month: p.forMonth,
          amount: p.amount,
          method: p.method,
          paidOn: p.paidOn,
          receiverId: p.receivedBy,
          receiverName: p.receivedBy ? (names.get(p.receivedBy) ?? "অজানা") : "অজানা",
        })),
    )
    .sort((a, b) => b.receiptNo - a.receiptNo)
  const admins = snap.members.filter((m) => m.member.status === "active" && m.member.role === "admin").map((m) => ({ id: m.member.id, name: m.member.nameBn }))
  return (
    <>
      <PageTitle>কার কাছে টাকা — সংশোধন</PageTitle>
      <FixReceivers rows={rows} admins={admins} />
    </>
  )
}
