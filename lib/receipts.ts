// One receipt per "save": months paid together (one payment form submit) share a receipt.
// Pure functions, unit-tested.
//
// Each month is still its own payment row (own receipt number, voidable on its own), but rows
// written by the same save have the same member, date, method and created_at (Postgres now() is
// fixed for the whole transaction), so they are shown and printed as one receipt.

export type ReceiptRow = {
  id: number
  receiptNo: number
  memberId: number
  forMonth: string
  amount: number
  paidOn: string
  method: string
  status: "valid" | "void"
  createdAt: Date | string
}

export type ReceiptGroup<T extends ReceiptRow = ReceiptRow> = {
  /** The first receipt number: the receipt's number and its PDF link. */
  receiptNo: number
  receiptNos: number[]
  rows: T[]
  /** Valid rows only. */
  total: number
  allVoid: boolean
}

export function receiptKey(r: ReceiptRow): string {
  const at = r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt).getTime()
  return `${r.memberId}|${r.paidOn}|${r.method}|${at}`
}

/** Groups payments into receipts, newest first (by first receipt number); rows inside are oldest month first. */
export function receiptGroups<T extends ReceiptRow>(rows: T[]): ReceiptGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = receiptKey(r)
    const list = map.get(k)
    if (list) list.push(r)
    else map.set(k, [r])
  }
  return [...map.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.forMonth.localeCompare(b.forMonth) || a.receiptNo - b.receiptNo)
      const nos = sorted.map((r) => r.receiptNo).sort((a, b) => a - b)
      return {
        receiptNo: nos[0],
        receiptNos: nos,
        rows: sorted,
        total: sorted.reduce((s, r) => (r.status === "valid" ? s + r.amount : s), 0),
        allVoid: sorted.every((r) => r.status === "void"),
      }
    })
    .sort((a, b) => b.receiptNo - a.receiptNo)
}

/** The receipt numbers printed together with `no` (its own save), never mixing members. */
export function sameReceipt<T extends ReceiptRow>(rows: T[], no: number): T[] {
  const me = rows.find((r) => r.receiptNo === no)
  if (!me) return []
  const k = receiptKey(me)
  return rows.filter((r) => receiptKey(r) === k).sort((a, b) => a.receiptNo - b.receiptNo)
}
