// Pure mapping from DB rows to Google Sheet rows (unit-tested). Column A is always
// the database id, so a row can be found and updated in place (e.g. when voided).
import type { SamitiSnapshot } from "@/lib/data"
import type { Payment, Transaction } from "@/lib/db/schema"
import { formatDate, formatDateTime, METHOD_LABELS, monthLabel, receiptLabel, TXN_TYPE_LABELS } from "@/lib/format"
import { monthOf } from "@/lib/ledger"

export type Cell = string | number
export type Row = Cell[]

export const SHEET_NOTE = "এই শিট শুধু দেখার জন্য। হিসাব লিখুন ওয়েবসাইটে।"

export const TABS = {
  members: "Members",
  payments: "Payments",
  transactions: "Transactions",
  summary: "Monthly Summary",
} as const
export type TabName = (typeof TABS)[keyof typeof TABS]

export const HEADERS: Record<TabName, string[]> = {
  // No phone numbers: the mirror may be shared with every member, and phones are admin-only in the app.
  Members: ["ID", "সদস্য নং", "নাম", "ভূমিকা", "অবস্থা", "শেয়ার (বর্তমান)", "যোগদান", "মোট দেয়", "মোট জমা", "বকেয়া", "নমিনি", "আপডেট"],
  Payments: ["ID", "রসিদ", "সদস্য নং", "সদস্য", "কোন মাসের", "টাকা", "জমার তারিখ", "মাধ্যম", "ট্রানজেকশন আইডি", "নোট", "অবস্থা", "বাতিলের কারণ", "এন্ট্রির সময়"],
  Transactions: ["ID", "তারিখ", "ধরন", "বিবরণ", "টাকা", "অনুমোদন", "সভার তারিখ", "ভোটের ফল", "রসিদের ছবি", "অবস্থা", "বাতিলের কারণ", "এন্ট্রির সময়"],
  "Monthly Summary": ["মাস", "মোট দেয়", "মোট জমা", "বাকি", "পরিশোধিত সদস্য", "আংশিক", "বকেয়া সদস্য"],
}

const statusText = (s: "valid" | "void") => (s === "void" ? "বাতিল" : "বৈধ")

export function memberRows(snap: SamitiSnapshot, ids?: Set<number>): Row[] {
  return snap.members
    .filter((m) => !ids || ids.has(m.member.id))
    .map((m) => [
      m.member.id,
      m.member.memberNo,
      m.member.nameBn,
      m.member.role === "admin" ? "অ্যাডমিন" : "সদস্য",
      m.member.status === "cancelled" ? "বাতিল" : "সক্রিয়",
      m.sharesNow,
      formatDate(m.member.joinedOn),
      m.expected,
      m.paid,
      m.due,
      m.member.nomineeName ?? "",
      formatDateTime(m.member.updatedAt),
    ])
}

export function paymentRow(p: Payment, memberNo: number, name: string): Row {
  return [
    p.id,
    receiptLabel(p.receiptNo),
    memberNo,
    name,
    monthLabel(p.forMonth),
    p.amount,
    formatDate(p.paidOn),
    METHOD_LABELS[p.method],
    p.trxId ?? "",
    p.note ?? "",
    statusText(p.status),
    p.voidReason ?? "",
    formatDateTime(p.createdAt),
  ]
}

export function paymentRows(snap: SamitiSnapshot, ids?: Set<number>): Row[] {
  return snap.members
    .flatMap((m) => m.payments.map((p) => ({ p, m })))
    .filter(({ p }) => !ids || ids.has(p.id))
    .sort((a, b) => a.p.receiptNo - b.p.receiptNo)
    .map(({ p, m }) => paymentRow(p, m.member.memberNo, m.member.nameBn))
}

export function transactionRow(t: Transaction): Row {
  return [
    t.id,
    formatDate(t.date),
    TXN_TYPE_LABELS[t.type],
    t.description,
    t.amount,
    t.approvedBy ?? "",
    t.meetingDate ? formatDate(t.meetingDate) : "",
    t.voteResult ?? "",
    t.receiptUrl ?? "",
    statusText(t.status),
    t.voidReason ?? "",
    formatDateTime(t.createdAt),
  ]
}

/** One row per month from start up to the current month (active members only). */
export function summaryRows(snap: SamitiSnapshot): Row[] {
  const current = monthOf(snap.today)
  const active = snap.members.filter((m) => m.member.status === "active")
  const months = (snap.members[0]?.lines ?? []).map((l) => l.month).filter((m) => m <= current)
  return months.map((month) => {
    let expected = 0
    let paid = 0
    let full = 0
    let partial = 0
    let unpaid = 0
    for (const m of active) {
      const line = m.lines.find((l) => l.month === month)
      if (!line) continue
      expected += line.expected
      paid += line.paid
      if (line.status === "paid") full++
      else if (line.status === "partial") partial++
      else if (line.status === "unpaid") unpaid++
    }
    return [monthLabel(month), expected, paid, Math.max(0, expected - paid), full, partial, unpaid]
  })
}
