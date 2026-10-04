// Pure parsing/validation for the one-time import from the old Google Sheet (spec §11).
// Nothing here touches the DB; scripts/import-from-sheet.ts does the I/O.
import { normalizePhone } from "@/lib/auth/pin"
import { fromBn, MONTHS_BN, TXN_TYPE_LABELS } from "@/lib/format"
import type { TxnType } from "@/lib/ledger"

export const ADMIN_PHONES = ["01859336893", "01310760069", "01834248280", "01723332916", "01980640702", "01892785486"]

export type Flag = { severity: "block" | "warn" | "info"; where: string; message: string }

export type ImportMember = {
  memberNo: number
  nameBn: string
  phone: string | null
  shares: number | null // null = flagged (invalid); no share_history row is created
  rawShares: string
  joinedOn: string | null
  nomineeName: string | null
  nomineePhone: string | null
  status: "active" | "cancelled"
  notes: string | null
  role: "member" | "admin"
}

export type ImportPayment = {
  row: number
  memberNo: number
  forMonth: string
  amount: number
  paidOn: string
  method: "cash" | "bkash" | "nagad" | "rocket" | "bank"
  trxId: string | null
  note: string | null
}

export type ImportTransaction = {
  row: number
  date: string
  type: TxnType
  description: string
  amount: number
  meetingDate: string | null
  voteResult: string | null
  approvedBy: string | null
  receiptRef: string | null
  note: string | null
}

// ── small parsers ────────────────────────────────────────────────────────────

/** RFC 4180 CSV (as exported by Google Sheets). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c !== "\r") field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

export function parseInt0(s: string | undefined): number | null {
  const t = fromBn(clean(s)).replace(/[,৳\s]/g, "")
  return /^\d+$/.test(t) ? Number(t) : null
}

/** "27/09/2026" (or Bengali digits, "-" or ".") → "2026-09-27". */
export function parseDate(s: string | undefined): string | null {
  const t = fromBn(clean(s))
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(t)
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const dt = new Date(iso + "T00:00:00Z")
    return dt.getUTCDate() === d ? iso : null
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

/** "অক্টোবর ২০২৬" → "2026-10-01" */
export function parseMonth(s: string | undefined): string | null {
  const t = clean(s)
  const idx = MONTHS_BN.findIndex((name) => t.startsWith(name))
  const year = /(\d{4})/.exec(fromBn(t))?.[1]
  if (idx === -1 || !year) return null
  return `${year}-${String(idx + 1).padStart(2, "0")}-01`
}

const METHOD_MAP: Record<string, ImportPayment["method"]> = {
  "নগদ টাকা": "cash",
  "ক্যাশ": "cash",
  "হাতে নগদ": "cash",
  cash: "cash",
  "বিকাশ": "bkash",
  bkash: "bkash",
  "রকেট": "rocket",
  rocket: "rocket",
  "ব্যাংক": "bank",
  bank: "bank",
  nagad: "nagad",
}

/** Plain "নগদ" is ambiguous (cash or the Nagad wallet), so it is flagged rather than guessed. */
export function parseMethod(s: string | undefined): ImportPayment["method"] | "ambiguous" | null {
  const t = clean(s).toLowerCase()
  if (!t) return "cash"
  if (t === "নগদ") return "ambiguous"
  return METHOD_MAP[t] ?? null
}

const TXN_TYPE_MAP: Record<string, TxnType> = Object.fromEntries(
  Object.entries(TXN_TYPE_LABELS).map(([k, v]) => [v, k as TxnType]),
)
Object.assign(TXN_TYPE_MAP, { "ব্যয়": "expense", "আয়": "business_income", "মুনাফা": "bank_profit", "ব্যাংক লাভ": "bank_profit" })

// ── tab parsers ──────────────────────────────────────────────────────────────

/** Find the header row (first row containing `marker`) and map column names → index. */
function header(rows: string[][], marker: string): { start: number; col: (name: string) => number } {
  const h = rows.findIndex((r) => r.some((c) => clean(c) === marker))
  if (h === -1) throw new Error(`Header "${marker}" not found`)
  const names = rows[h].map(clean)
  return {
    start: h + 1,
    col: (name) => {
      const i = names.indexOf(name)
      if (i === -1) throw new Error(`Column "${name}" not found (have: ${names.filter(Boolean).join(", ")})`)
      return i
    },
  }
}

export function parseMembers(rows: string[][], flags: Flag[]): ImportMember[] {
  const { start, col } = header(rows, "সদস্য নং")
  const c = {
    no: col("সদস্য নং"),
    name: col("সদস্যের নাম"),
    phone: col("মোবাইল নম্বর"),
    shares: col("শেয়ার সংখ্যা"),
    joined: col("যোগদানের তারিখ"),
    nominee: col("নমিনির নাম"),
    nomineePhone: col("নমিনির মোবাইল"),
    status: col("অবস্থা"),
    notes: col("মন্তব্য"),
  }
  const out: ImportMember[] = []
  const seenNo = new Set<number>()
  const seenPhone = new Map<string, number>()
  rows.slice(start).forEach((r, i) => {
    const where = `সদস্য তালিকা, সারি ${start + i + 1}`
    const no = parseInt0(r[c.no])
    const name = clean(r[c.name])
    if (no === null) {
      if (r.some((x) => clean(x))) flags.push({ severity: "info", where, message: "সদস্য নং নেই — মোট/খালি সারি হিসেবে বাদ দেওয়া হলো" })
      return
    }
    if (!name) return void flags.push({ severity: "block", where, message: `সদস্য ${no}: নাম নেই` })
    if (seenNo.has(no)) return void flags.push({ severity: "block", where, message: `সদস্য নং ${no} দুইবার আছে` })
    seenNo.add(no)

    const rawPhone = clean(r[c.phone])
    let phone: string | null = null
    if (!rawPhone) flags.push({ severity: "warn", where, message: `সদস্য ${no} (${name}): মোবাইল নম্বর নেই — সদস্য নং দিয়ে লগইন করবেন` })
    else {
      phone = normalizePhone(rawPhone)
      if (!phone) flags.push({ severity: "warn", where, message: `সদস্য ${no} (${name}): মোবাইল নম্বর সঠিক নয় "${rawPhone}" — বাদ রাখা হলো` })
      else if (seenPhone.has(phone)) {
        flags.push({ severity: "block", where, message: `সদস্য ${no}: মোবাইল ${phone} সদস্য ${seenPhone.get(phone)}-এরও` })
        phone = null
      } else seenPhone.set(phone, no)
    }

    const rawShares = clean(r[c.shares])
    const n = parseInt0(rawShares)
    let shares: number | null = n
    if (n === null || n < 1) {
      flags.push({ severity: "block", where, message: `সদস্য ${no} (${name}): শেয়ার সংখ্যা সঠিক নয় "${rawShares}"` })
      shares = null
    }

    const rawJoined = clean(r[c.joined])
    const joinedOn = rawJoined ? parseDate(rawJoined) : null
    if (rawJoined && !joinedOn) flags.push({ severity: "warn", where, message: `সদস্য ${no}: যোগদানের তারিখ বোঝা যায়নি "${rawJoined}"` })

    const statusText = clean(r[c.status])
    const status = statusText === "বাতিল" ? "cancelled" : "active"
    const nomineePhoneRaw = clean(r[c.nomineePhone])
    const nomineePhone = nomineePhoneRaw ? normalizePhone(nomineePhoneRaw) : null
    if (nomineePhoneRaw && !nomineePhone) flags.push({ severity: "warn", where, message: `সদস্য ${no}: নমিনির মোবাইল সঠিক নয় — বাদ রাখা হলো` })

    out.push({
      memberNo: no,
      nameBn: name,
      phone,
      shares,
      rawShares,
      joinedOn,
      nomineeName: clean(r[c.nominee]) || null,
      nomineePhone,
      status,
      notes: clean(r[c.notes]) || null,
      role: phone && ADMIN_PHONES.includes(phone) ? "admin" : "member",
    })
  })
  for (const p of ADMIN_PHONES) {
    if (!out.some((m) => m.phone === p)) flags.push({ severity: "warn", where: "অ্যাডমিন", message: `অ্যাডমিন মোবাইল ${p} কোনো সদস্যের সাথে মেলেনি` })
  }
  return out
}

export function parsePayments(rows: string[][], memberNos: Set<number>, flags: Flag[]): ImportPayment[] {
  const { start, col } = header(rows, "সদস্য নং")
  const c = {
    date: col("জমার তারিখ"),
    no: col("সদস্য নং"),
    month: col("কোন মাসের চাঁদা"),
    amount: col("চাঁদার টাকা"),
    fine: col("জরিমানা"),
    method: col("মাধ্যম"),
    receipt: col("রসিদ নং"),
    by: col("কে টাকা নিলেন"),
    note: col("মন্তব্য"),
  }
  const out: ImportPayment[] = []
  rows.slice(start).forEach((r, i) => {
    const rowNo = start + i + 1
    const where = `জমা খাতা, সারি ${rowNo}`
    if (!r.some((x) => clean(x))) return
    const no = parseInt0(r[c.no])
    if (no === null || !memberNos.has(no)) {
      return void flags.push({ severity: "block", where, message: `সদস্য নং "${clean(r[c.no])}" সদস্য তালিকায় নেই` })
    }
    const paidOn = parseDate(r[c.date])
    if (!paidOn) {
      return void flags.push({
        severity: "block",
        where,
        message: `সদস্য ${no}: জমার তারিখ ${clean(r[c.date]) ? `বোঝা যায়নি "${clean(r[c.date])}"` : "নেই"}`,
      })
    }
    const forMonth = parseMonth(r[c.month])
    if (!forMonth) return void flags.push({ severity: "block", where, message: `সদস্য ${no}: মাস বোঝা যায়নি "${clean(r[c.month])}"` })
    const amount = parseInt0(r[c.amount])
    if (!amount) return void flags.push({ severity: "block", where, message: `সদস্য ${no}: টাকার পরিমাণ সঠিক নয় "${clean(r[c.amount])}"` })
    const method = parseMethod(r[c.method])
    if (method === "ambiguous") {
      return void flags.push({ severity: "block", where, message: `সদস্য ${no}: মাধ্যম "নগদ" — হাতে নগদ (ক্যাশ) নাকি নগদ অ্যাপ? শিটে "নগদ টাকা" বা "নগদ অ্যাপ" লিখুন` })
    }
    if (!method) return void flags.push({ severity: "block", where, message: `সদস্য ${no}: মাধ্যম বোঝা যায়নি "${clean(r[c.method])}"` })
    if (parseInt0(r[c.fine])) flags.push({ severity: "warn", where, message: `সদস্য ${no}: জরিমানা লেখা আছে — নিয়মে জরিমানা নেই, ইমপোর্ট হবে না` })

    // In the old sheet "রসিদ নং" holds the bKash/Nagad transaction id for mobile payments.
    const ref = clean(r[c.receipt])
    const by = clean(r[c.by])
    const remark = clean(r[c.note])
    const notes = [
      by ? `গ্রহণকারী: ${by}` : "",
      ref && method === "cash" ? `পুরনো রসিদ নং: ${ref}` : "",
      remark && remark.toLowerCase() !== "received" ? remark : "",
      "শিট থেকে ইমপোর্ট",
    ].filter(Boolean)
    out.push({
      row: rowNo,
      memberNo: no,
      forMonth,
      amount,
      paidOn,
      method,
      trxId: ref && method !== "cash" ? ref : null,
      note: notes.join(" · "),
    })
  })
  return out
}

export function parseTransactions(rows: string[][], flags: Flag[]): ImportTransaction[] {
  const { start, col } = header(rows, "ধরন")
  const c = {
    date: col("তারিখ"),
    type: col("ধরন"),
    desc: col("বিবরণ"),
    amount: col("টাকা"),
    meeting: col("সভার তারিখ"),
    vote: col("ভোট (হ্যাঁ/না)"),
    approver: col("অনুমোদনকারী"),
    proof: col("রসিদ/প্রমাণ"),
    note: col("মন্তব্য"),
  }
  const out: ImportTransaction[] = []
  rows.slice(start).forEach((r, i) => {
    const rowNo = start + i + 1
    const where = `আয়-ব্যয় ও বিনিয়োগ, সারি ${rowNo}`
    const rawDate = clean(r[c.date])
    const date = parseDate(rawDate)
    if (!date) {
      // Instruction rows have text in the first cell but nothing else.
      const others = r.slice(1).some((x) => clean(x))
      if (others || (rawDate && parseInt0(r[c.amount]))) {
        flags.push({ severity: "block", where, message: `তারিখ ${rawDate ? `বোঝা যায়নি "${rawDate}"` : "নেই"}` })
      }
      return
    }
    const type = TXN_TYPE_MAP[clean(r[c.type])]
    if (!type) return void flags.push({ severity: "block", where, message: `ধরন বোঝা যায়নি "${clean(r[c.type])}"` })
    const amount = parseInt0(r[c.amount])
    if (!amount) return void flags.push({ severity: "block", where, message: `টাকার পরিমাণ সঠিক নয় "${clean(r[c.amount])}"` })
    const description = clean(r[c.desc])
    if (!description) flags.push({ severity: "warn", where, message: "বিবরণ নেই" })
    out.push({
      row: rowNo,
      date,
      type,
      description: description || TXN_TYPE_LABELS[type],
      amount,
      meetingDate: parseDate(r[c.meeting]),
      voteResult: clean(r[c.vote]) || null,
      approvedBy: clean(r[c.approver]) || null,
      receiptRef: clean(r[c.proof]) || null,
      note: clean(r[c.note]) || null,
    })
  })
  return out
}
