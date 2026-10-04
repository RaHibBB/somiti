// Display helpers. Values are stored in standard form (ISO dates, integer taka);
// these convert to Bengali for display only.

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]

/** Convert ASCII digits in a number/string to Bengali digits. */
export function toBn(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])
}

/** Convert Bengali digits back to ASCII (for parsing user input). */
export function fromBn(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
}

/** Group with Indian/Bangladeshi style separators (12,34,567). */
function groupIndian(n: number): string {
  const neg = n < 0
  const s = String(Math.abs(Math.trunc(n)))
  if (s.length <= 3) return (neg ? "-" : "") + s
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")
  return (neg ? "-" : "") + rest + "," + last3
}

/** Integer taka → "৳১২,৫০০" */
export function taka(amount: number): string {
  return (amount < 0 ? "−৳" : "৳") + toBn(groupIndian(Math.abs(amount)))
}

/** Plain Bengali number with separators, no currency sign. */
export function bnNum(n: number): string {
  return toBn(groupIndian(n))
}

/** ISO date "2026-10-05" → "০৫/১০/২০২৬" */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const s = typeof iso === "string" ? iso : dhakaDateString(iso)
  const [y, m, d] = s.slice(0, 10).split("-")
  return toBn(`${d}/${m}/${y}`)
}

/** Timestamp → "০৫/১০/২০২৬ ১৪:৩০" in Asia/Dhaka */
export function formatDateTime(ts: Date | string): string {
  const date = typeof ts === "string" ? new Date(ts) : ts
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  return toBn(`${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`)
}

export const MONTHS_BN = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
]

// Slicing Bengali strings can split a conjunct, so short names are spelled out.
export const MONTHS_BN_SHORT = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"]

/** "2026-10-01" → "অক্টোবর ২০২৬" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-")
  return `${MONTHS_BN[Number(m) - 1]} ${toBn(y)}`
}

/** "2026-10-01" → "অক্টো ২৬" (grid headers) */
export function monthShort(month: string): string {
  const [y, m] = month.split("-")
  return `${MONTHS_BN_SHORT[Number(m) - 1]} ${toBn(y.slice(2))}`
}

/** A Date's calendar day in Asia/Dhaka as "YYYY-MM-DD". */
export function dhakaDateString(date: Date = new Date()): string {
  // en-CA gives ISO-style YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Today in Asia/Dhaka as "YYYY-MM-DD". */
export function todayDhaka(): string {
  return dhakaDateString(new Date())
}

export const WEEKDAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"]

/** "2026-10-04" → "রবিবার, ৪ অক্টোবর ২০২৬" */
export function dateLongBn(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${WEEKDAYS_BN[weekday]}, ${toBn(d)} ${MONTHS_BN[m - 1]} ${toBn(y)}`
}

/** Receipt number 12 → "R-0012" */
export function receiptLabel(n: number): string {
  return "R-" + String(n).padStart(4, "0")
}

export const METHOD_LABELS: Record<string, string> = {
  cash: "ক্যাশ",
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  bank: "ব্যাংক",
}

export const TXN_TYPE_LABELS: Record<string, string> = {
  expense: "খরচ",
  investment: "বিনিয়োগ",
  business_income: "ব্যবসায়িক আয়",
  investment_return: "বিনিয়োগ ফেরত",
  bank_profit: "ব্যাংক মুনাফা",
  member_refund: "সদস্য ফেরত",
  dividend: "লভ্যাংশ",
}
