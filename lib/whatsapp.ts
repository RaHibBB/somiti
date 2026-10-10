// wa.me links with prefilled Bengali text — free, no API.
import { formatDate, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"

export const SAMITI_NAME = "পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"

/** "01712345678" → "8801712345678" (wa.me wants the country code, no +). */
export function waNumber(phone: string | null | undefined): string | null {
  if (phone && /^\+[1-9]\d{7,14}$/.test(phone)) return phone.slice(1)
  if (!phone || !/^01\d{9}$/.test(phone)) return null
  return "88" + phone
}

/** Without a phone, wa.me opens WhatsApp's contact picker with the text ready. */
export function waLink(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone)
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`
}

function greeting(name: string): string {
  const n = name.trim()
  return `আসসালামু আলাইকুম, ${/ভাই$/.test(n) ? n : `${n} ভাই`}।`
}

export function receiptMessage(input: {
  name: string
  receipts: { receiptNo: number; forMonth: string; amount: number }[]
  paidOn: string
  dueAfter: number
  /** This month's amount still unpaid (inside the 1st–10th window), after this payment. */
  currentOpenAfter?: number
  /** The admin who took the money. */
  receivedBy?: string
}): string {
  const after: string[] = []
  if (input.dueAfter > 0) after.push(`বর্তমান বকেয়া: ${taka(input.dueAfter)}`)
  if ((input.currentOpenAfter ?? 0) > 0) after.push(`এই মাসের আরও ${taka(input.currentOpenAfter ?? 0)} বাকি আছে।`)
  if (after.length === 0) after.push("আপনার কোনো বকেয়া নেই, আলহামদুলিল্লাহ।")
  const lines = input.receipts.map((r) => `• ${monthLabel(r.forMonth)} — ${taka(r.amount)} (রসিদ ${receiptLabel(r.receiptNo)})`)
  const total = input.receipts.reduce((s, r) => s + r.amount, 0)
  return [
    greeting(input.name),
    `আপনার চাঁদা জমা হয়েছে, জাযাকাল্লাহ। বিস্তারিত:`,
    ...lines,
    input.receipts.length > 1 ? `মোট: ${taka(total)}` : null,
    `তারিখ: ${formatDate(input.paidOn)}`,
    input.receivedBy ? `টাকা গ্রহণ করেছেন: ${input.receivedBy}` : null,
    ...after,
    `ধন্যবাদ — ${SAMITI_NAME}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function reminderMessage(input: { name: string; due: number; months: string[]; dueDay: number }): string {
  const monthText = input.months.map(monthLabel).join(", ")
  return [
    greeting(input.name),
    `একটু মনে করিয়ে দিচ্ছি — সমিতিতে আপনার ${toBn(input.months.length)} মাসের চাঁদা বকেয়া আছে (${monthText})।`,
    `মোট বকেয়া: ${taka(input.due)}`,
    `সুবিধামতো দ্রুত পরিশোধ করলে খুশি হব। প্রতি মাসের চাঁদা ${toBn(input.dueDay)} তারিখের মধ্যে দিতে হয়। কোনো সমস্যা থাকলে জানাবেন।`,
    `ধন্যবাদ — ${SAMITI_NAME}`,
  ].join("\n")
}

/**
 * One-tap monthly summary for the samiti's WhatsApp group (sent via wa.me, so the admin
 * picks the group). Lists who still owes — accounts are transparent to all members.
 */
export function monthlyGroupMessage(input: {
  month: string
  paidCount: number
  activeCount: number
  collected: number
  expected: number
  owing: { no: number; name: string; due: number }[]
  /** Active members who haven't paid this month yet (still inside the 1st–10th window). */
  notYet?: { no: number; name: string }[]
  fundTotal: number
  cash: number
  invested: number
  reportUrl: string
}): string {
  // Never say "no dues" while some members haven't paid this month — that reads as a contradiction.
  const nothingPending = input.owing.length === 0 && !input.notYet?.length
  const owingLines = input.owing.length
    ? [`বকেয়া আছে ${toBn(input.owing.length)} জনের:`, ...input.owing.map((o) => `• ${toBn(o.no)}. ${o.name} — ${taka(o.due)}`)]
    : nothingPending
      ? ["সবাই চাঁদা পরিশোধ করেছেন। সবাইকে ধন্যবাদ!"]
      : []
  return [
    `${SAMITI_NAME}`,
    `${monthLabel(input.month)} — মাসিক হিসাব`,
    "",
    `চাঁদা আদায়: ${taka(input.collected)} / ${taka(input.expected)} (${toBn(input.paidCount)}/${toBn(input.activeCount)} জন পুরো দিয়েছেন)`,
    ...owingLines,
    ...(input.notYet?.length
      ? ["", `এই মাসের চাঁদা এখনো দেননি (${toBn(input.notYet.length)} জন): ${input.notYet.map((o) => `${toBn(o.no)}. ${o.name}`).join(", ")}`]
      : []),
    "",
    `সমিতির তহবিল: ${taka(input.fundTotal)} (নগদ ${taka(input.cash)}, বিনিয়োগ ${taka(input.invested)})`,
    `বিস্তারিত রিপোর্ট: ${input.reportUrl}`,
  ].join("\n")
}

/** A member's account at a glance — for an admin to send on WhatsApp. */
export function accountSummaryMessage(input: {
  name: string
  memberNo: number
  shares: number
  sharePrice: number
  paid: number
  due: number
  overdueMonths: string[]
  /** This month's unpaid amount, still inside the payment window. */
  currentOpen: number
  dueDay: number
  accountUrl: string
}): string {
  const status: string[] = []
  if (input.due > 0) status.push(`• বকেয়া: ${taka(input.due)} (${input.overdueMonths.map(monthLabel).join(", ")})`)
  if (input.currentOpen > 0) {
    status.push(`• এই মাসের চাঁদা ${taka(input.currentOpen)} এখনো জমা হয়নি — ${toBn(input.dueDay)} তারিখের মধ্যে দিন।`)
  }
  if (status.length === 0) status.push("• আপনার কোনো বকেয়া নেই। ধন্যবাদ!")
  return [
    greeting(input.name),
    `সমিতিতে আপনার হিসাব (সদস্য নং ${toBn(input.memberNo)}):`,
    `• শেয়ার: ${toBn(input.shares)}টি (মাসে ${taka(input.shares * input.sharePrice)})`,
    `• মোট জমা: ${taka(input.paid)}`,
    ...status,
    `বিস্তারিত দেখুন: ${input.accountUrl}`,
    `— ${SAMITI_NAME}`,
  ].join("\n")
}

/** Friendly nudge before the due date: this month's amount is still unpaid. */
export function upcomingReminderMessage(input: { name: string; month: string; amount: number; dueDay: number }): string {
  return [
    greeting(input.name),
    `একটু মনে করিয়ে দিচ্ছি — ${monthLabel(input.month)}-এর চাঁদা ${taka(input.amount)} এখনো জমা হয়নি।`,
    `সুবিধামতো ${toBn(input.dueDay)} তারিখের মধ্যে দিয়ে দিলে ভালো হয়।`,
    `ধন্যবাদ — ${SAMITI_NAME}`,
  ].join("\n")
}

/** A notice, formatted for the samiti's WhatsApp group. */
export function noticeMessage(input: { title: string; body: string; url: string }): string {
  return [`📢 ${SAMITI_NAME}`, "", `*${input.title}*`, input.body, "", `সব নোটিশ: ${input.url}`].join("\n")
}

/** First-login details for a member (login id + temporary password) — sent by an admin on WhatsApp. */
export function inviteMessage(input: {
  name: string
  memberNo: number
  phone: string | null
  pin: string
  loginUrl: string
}): string {
  return [
    greeting(input.name),
    `${SAMITI_NAME}-এর ওয়েবসাইটে আপনার লগইন তথ্য:`,
    `লিংক: ${input.loginUrl}`,
    `লগইন: ${input.phone ? `${toBn(input.phone)} (অথবা সদস্য নং ${toBn(input.memberNo)})` : `সদস্য নং ${toBn(input.memberNo)}`}`,
    `অস্থায়ী পাসওয়ার্ড: ${toBn(input.pin)}`,
    "প্রথমবার ঢুকলে নিজের একটি নতুন পাসওয়ার্ড দিতে হবে। দয়া করে পাসওয়ার্ড কাউকে বলবেন না। কোনো সমস্যা হলে জানাবেন।",
  ].join("\n")
}
