import { describe, expect, it } from "vitest"
import { receiptGroups, sameReceipt, type ReceiptRow } from "@/lib/receipts"

const at = (s: string) => new Date(s)
const row = (receiptNo: number, forMonth: string, extra: Partial<ReceiptRow> = {}): ReceiptRow => ({
  id: receiptNo,
  receiptNo,
  memberId: 31,
  forMonth,
  amount: 500,
  paidOn: "2026-11-07",
  method: "cash",
  status: "valid",
  createdAt: at("2026-11-07T15:29:54.125Z"),
  ...extra,
})

describe("one receipt per save", () => {
  // Sahid: Oct (paid alone in October) + Oct 2nd share and Nov paid together on 7 Nov.
  const rows = [
    row(14, "2026-10-01", { paidOn: "2026-10-04", createdAt: at("2026-10-04T13:28:38Z") }),
    row(68, "2026-10-01"),
    row(69, "2026-11-01", { amount: 1000 }),
  ]

  it("months saved together become one receipt; earlier saves stay separate", () => {
    const g = receiptGroups(rows)
    expect(g.map((x) => x.receiptNos)).toEqual([[68, 69], [14]])
    expect(g[0]).toMatchObject({ receiptNo: 68, total: 1500, allVoid: false })
    expect(g[0].rows.map((r) => r.forMonth)).toEqual(["2026-10-01", "2026-11-01"])
  })

  it("any month's number opens the whole receipt", () => {
    expect(sameReceipt(rows, 69).map((r) => r.receiptNo)).toEqual([68, 69])
    expect(sameReceipt(rows, 14).map((r) => r.receiptNo)).toEqual([14])
    expect(sameReceipt(rows, 999)).toEqual([])
  })

  it("a voided month stays on the receipt but not in the total", () => {
    const g = receiptGroups([row(68, "2026-10-01"), row(69, "2026-11-01", { status: "void" })])
    expect(g[0]).toMatchObject({ total: 500, allVoid: false })
    expect(receiptGroups([row(68, "2026-10-01", { status: "void" })])[0].allVoid).toBe(true)
  })

  it("never merges different members, dates or methods, even at the same moment", () => {
    const g = receiptGroups([row(1, "2026-10-01"), row(2, "2026-11-01", { memberId: 32 }), row(3, "2026-12-01", { method: "bkash" }), row(4, "2027-01-01", { paidOn: "2026-11-08" })])
    expect(g).toHaveLength(4)
  })
})
