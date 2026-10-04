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
