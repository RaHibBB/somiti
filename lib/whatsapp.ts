// wa.me links with prefilled Bengali text — free, no API.
import { formatDate, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"

export const SAMITI_NAME = "পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"

/** "01712345678" → "8801712345678" (wa.me wants the country code, no +). */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone || !/^01\d{9}$/.test(phone)) return null
  return "88" + phone
}

/** Without a phone, wa.me opens WhatsApp's contact picker with the text ready. */
export function waLink(phone: string | null | undefined, text: string): string {
  const n = waNumber(phone)
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`
}

export function receiptMessage(input: {
  name: string
  receipts: { receiptNo: number; forMonth: string; amount: number }[]
  paidOn: string
  dueAfter: number
}): string {
  const lines = input.receipts.map((r) => `• ${monthLabel(r.forMonth)} — ${taka(r.amount)} (রসিদ ${receiptLabel(r.receiptNo)})`)
  const total = input.receipts.reduce((s, r) => s + r.amount, 0)
  return [
    `আসসালামু আলাইকুম, ${input.name}।`,
    `আপনার চাঁদা জমা হয়েছে:`,
    ...lines,
    input.receipts.length > 1 ? `মোট: ${taka(total)}` : null,
    `তারিখ: ${formatDate(input.paidOn)}`,
    input.dueAfter > 0 ? `বর্তমান বকেয়া: ${taka(input.dueAfter)}` : `আপনার কোনো বকেয়া নেই।`,
    `ধন্যবাদ — ${SAMITI_NAME}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function reminderMessage(input: { name: string; due: number; months: string[]; dueDay: number }): string {
  const monthText = input.months.map(monthLabel).join(", ")
  return [
    `আসসালামু আলাইকুম, ${input.name}।`,
    `সমিতিতে আপনার ${toBn(input.months.length)} মাসের চাঁদা বকেয়া আছে (${monthText})।`,
    `মোট বকেয়া: ${taka(input.due)}`,
    `অনুগ্রহ করে দ্রুত পরিশোধ করুন। প্রতি মাসের চাঁদা ${toBn(input.dueDay)} তারিখের মধ্যে দিতে হয়।`,
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
  fundTotal: number
  cash: number
  invested: number
  reportUrl: string
}): string {
  const owingLines = input.owing.length
    ? [`বকেয়া আছে ${toBn(input.owing.length)} জনের:`, ...input.owing.map((o) => `• ${toBn(o.no)}. ${o.name} — ${taka(o.due)}`)]
    : ["কারো কোনো বকেয়া নেই। সবাইকে ধন্যবাদ!"]
  return [
    `${SAMITI_NAME}`,
    `${monthLabel(input.month)} — মাসিক হিসাব`,
    "",
    `চাঁদা আদায়: ${taka(input.collected)} / ${taka(input.expected)} (${toBn(input.paidCount)}/${toBn(input.activeCount)} জন পুরো দিয়েছেন)`,
    ...owingLines,
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
  accountUrl: string
}): string {
  return [
    `আসসালামু আলাইকুম, ${input.name}।`,
    `সমিতিতে আপনার হিসাব (সদস্য নং ${toBn(input.memberNo)}):`,
    `• শেয়ার: ${toBn(input.shares)}টি (মাসে ${taka(input.shares * input.sharePrice)})`,
    `• মোট জমা: ${taka(input.paid)}`,
    input.due > 0
      ? `• বকেয়া: ${taka(input.due)} (${input.overdueMonths.map(monthLabel).join(", ")})`
      : "• আপনার কোনো বকেয়া নেই। ধন্যবাদ!",
    `বিস্তারিত দেখুন: ${input.accountUrl}`,
    `— ${SAMITI_NAME}`,
  ].join("\n")
}

/** A notice, formatted for the samiti's WhatsApp group. */
export function noticeMessage(input: { title: string; body: string; url: string }): string {
  return [`📢 ${SAMITI_NAME}`, "", `*${input.title}*`, input.body, "", `সব নোটিশ: ${input.url}`].join("\n")
}
