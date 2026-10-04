// Synthetic data only, shaped like the real sheet's tabs.
import { describe, expect, it } from "vitest"
import {
  parseCsv,
  parseDate,
  parseMembers,
  parseMethod,
  parseMonth,
  parsePayments,
  parseTransactions,
  type Flag,
} from "@/lib/import/parse"

const csv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")

const MEMBER_HEAD = ["সদস্য নং", "সদস্যের নাম", "মোবাইল নম্বর", "শেয়ার সংখ্যা", "মাসিক চাঁদা (টাকা)", "শেয়ারের অংশ (%)", "যোগদানের তারিখ", "নমিনির নাম", "নমিনির মোবাইল", "অবস্থা", "মন্তব্য"]
const PAY_HEAD = ["জমার তারিখ ", "সদস্য নং ", "সদস্যের নাম  ", "কোন মাসের চাঁদা ", "চাঁদার টাকা ", "জরিমানা ", "মাধ্যম ", "রসিদ নং ", "কে টাকা নিলেন ", "মন্তব্য ", "", ""]
const TXN_HEAD = ["তারিখ", "ধরন", "বিবরণ", "টাকা", "সভার তারিখ", "ভোট (হ্যাঁ/না)", "অনুমোদনকারী", "রসিদ/প্রমাণ", "মন্তব্য"]

describe("import helpers", () => {
  it("parses CSV with quotes and BOM", () => {
    expect(parseCsv('﻿"a","b ""x"""\n"1,2",3\n')).toEqual([
      ["a", 'b "x"'],
      ["1,2", "3"],
    ])
  })
  it("parses dates, months and methods", () => {
    expect(parseDate("27/09/2026")).toBe("2026-09-27")
    expect(parseDate("২৭/০৯/২০২৬")).toBe("2026-09-27")
    expect(parseDate("31/02/2026")).toBeNull()
    expect(parseMonth("অক্টোবর ২০২৬")).toBe("2026-10-01")
    expect(parseMonth("জানুয়ারি 2027")).toBe("2027-01-01")
    expect(parseMethod("নগদ টাকা")).toBe("cash")
    expect(parseMethod("বিকাশ ")).toBe("bkash")
    expect(parseMethod("নগদ")).toBe("ambiguous")
  })
})

describe("members tab", () => {
  const rows = parseCsv(
    csv([
      MEMBER_HEAD,
      ["1", "প্রথম", "01859336893", "1", "500", "", "", "", "", "সক্রিয়", ""],
      ["2", "দ্বিতীয়", "", "2", "1,000", "", "", "", "", "সক্রিয়", "মোবাইল নম্বর দরকার"],
      ["3", "তৃতীয়", "01700000003", "10", "5,000", "", "", "", "", "সক্রিয়", ""],
      ["", "", "", "13", "6,500", "", "", "", "", "", ""],
    ]),
  )

  it("imports members, seeds admins by phone, flags without fixing", () => {
    const flags: Flag[] = []
    const ms = parseMembers(rows, flags)
    expect(ms.map((m) => m.memberNo)).toEqual([1, 2, 3])
    expect(ms[0].role).toBe("admin")
    expect(ms[1]).toMatchObject({ role: "member", phone: null, shares: 2 })
    expect(ms[2].shares).toBeNull() // >5 shares: not auto-fixed
    expect(flags.some((f) => f.severity === "block" && f.message.includes("10 শেয়ার"))).toBe(true)
    expect(flags.some((f) => f.severity === "warn" && f.message.includes("মোবাইল নম্বর নেই"))).toBe(true)
    expect(flags.some((f) => f.severity === "info" && f.message.includes("মোট"))).toBe(true) // totals row skipped
    // The other 5 admin phones aren't in this synthetic list
    expect(flags.filter((f) => f.where === "অ্যাডমিন")).toHaveLength(5)
  })
})

describe("payments tab", () => {
  const rows = parseCsv(
    csv([
      PAY_HEAD,
      ["27/09/2026", "1", "প্রথম", "অক্টোবর ২০২৬", "500", "", "নগদ টাকা", "", "Jahed", "Received ", "", ""],
      ["29/09/2026", "2", "দ্বিতীয়", "অক্টোবর ২০২৬", "1,000", "", "বিকাশ", "DIT24JNBG4", "Rahib ", "Received ", "", ""],
      ["", "2", "দ্বিতীয়", "নভেম্বর ২০২৬", "1,000", "", "নগদ টাকা", "", "", "", "", ""],
      ["01/10/2026", "99", "অজানা", "অক্টোবর ২০২৬", "500", "", "নগদ টাকা", "", "", "", "", ""],
    ]),
  )

  it("maps columns, keeps trx id for bKash and flags missing dates / unknown members", () => {
    const flags: Flag[] = []
    const ps = parsePayments(rows, new Set([1, 2]), flags)
    expect(ps).toHaveLength(2)
    expect(ps[0]).toMatchObject({ memberNo: 1, forMonth: "2026-10-01", amount: 500, paidOn: "2026-09-27", method: "cash", trxId: null })
    expect(ps[0].note).toContain("গ্রহণকারী: Jahed")
    expect(ps[0].note).not.toContain("Received")
    expect(ps[1]).toMatchObject({ method: "bkash", trxId: "DIT24JNBG4", amount: 1000 })
    expect(flags.filter((f) => f.severity === "block").map((f) => f.message)).toEqual([
      expect.stringContaining("জমার তারিখ নেই"),
      expect.stringContaining('"99"'),
    ])
  })
})

describe("transactions tab", () => {
  it("skips the instruction row and maps Bengali types", () => {
    const rows = parseCsv(
      csv([
        TXN_HEAD,
        ["'ধরন' ঘরে ড্রপডাউন থেকে বাছুন।", "", "", "", "", "", "", "", ""],
        ["06/10/2026", "খরচ", "রসিদ বই", "350", "05/10/2026", "", "সভা", "", ""],
        ["07/10/2026", "অজানা", "x", "10", "", "", "", "", ""],
      ]),
    )
    const flags: Flag[] = []
    const ts = parseTransactions(rows, flags)
    expect(ts).toEqual([
      expect.objectContaining({ date: "2026-10-06", type: "expense", amount: 350, meetingDate: "2026-10-05", approvedBy: "সভা" }),
    ])
    expect(flags).toEqual([expect.objectContaining({ severity: "block", message: expect.stringContaining("ধরন") })])
  })
})
