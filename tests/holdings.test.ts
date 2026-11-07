import { describe, expect, it } from "vitest"
import { monthHoldings } from "@/lib/holdings"

const A = 1
const B = 2

const pays = [
  { receivedBy: A, amount: 1000, status: "valid" as const, paidOn: "2026-10-03" },
  { receivedBy: A, amount: 500, status: "valid" as const, paidOn: "2026-10-20" },
  { receivedBy: B, amount: 700, status: "valid" as const, paidOn: "2026-11-02" },
  { receivedBy: A, amount: 400, status: "valid" as const, paidOn: "2026-11-05" },
  { receivedBy: A, amount: 999, status: "void" as const, paidOn: "2026-11-05" },
  { receivedBy: null, amount: 250, status: "valid" as const, paidOn: "2026-11-06" },
]
const handovers = [
  { fromId: A, toId: null, amount: 1200, status: "valid" as const, date: "2026-10-28" },
  { fromId: A, toId: B, amount: 100, status: "valid" as const, date: "2026-11-10" },
  { fromId: B, toId: null, amount: 800, status: "valid" as const, date: "2026-11-12" },
  { fromId: B, toId: null, amount: 5, status: "void" as const, date: "2026-11-12" },
]

describe("monthHoldings", () => {
  it("October: collected, banked, what is left in hand", () => {
    const h = monthHoldings(pays, handovers, "2026-10-01")
    const a = h.holders.find((x) => x.id === A)!
    expect(a.opening).toBe(0)
    expect(a.collected).toBe(1500)
    expect(a.toBank).toBe(1200)
    expect(a.closing).toBe(300)
    expect(h.inHand).toBe(300)
    expect(h.bankTotal).toBe(1200)
    expect(h.unknownAmount).toBe(0)
  })

  it("November: carries October's leftover in, handles admin→admin, ignores void rows, flags unknown holders", () => {
    const h = monthHoldings(pays, handovers, "2026-11-01")
    const a = h.holders.find((x) => x.id === A)!
    const b = h.holders.find((x) => x.id === B)!
    expect(a.opening).toBe(300)
    expect(a.collected).toBe(400)
    expect(a.givenOut).toBe(100)
    expect(a.closing).toBe(600)
    expect(b.collected).toBe(700)
    expect(b.receivedIn).toBe(100)
    expect(b.toBank).toBe(800)
    expect(b.closing).toBe(0)
    expect(h.collected).toBe(1100)
    expect(h.toBank).toBe(800)
    expect(h.bankTotal).toBe(2000)
    expect(h.inHand).toBe(600)
    expect(h.unknownAmount).toBe(250)
  })

  it("a month with nothing in it still shows what is carried in hand", () => {
    const h = monthHoldings(pays, handovers, "2026-12-01")
    expect(h.collected).toBe(0)
    expect(h.inHand).toBe(600)
    expect(h.holders.find((x) => x.id === A)?.opening).toBe(600)
  })
})
