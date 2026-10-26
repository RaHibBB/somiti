// "How much does each admin still hold?" = money they received − money they handed over + money
// handed to them. Pure functions, so the page and the tests share one calculation.

export type HolderPayment = { receivedBy: number | null; amount: number; status: "valid" | "void" }
export type HolderHandover = { fromId: number; toId: number | null; amount: number; status: "valid" | "void" }

export type HolderBalance = {
  id: number
  collected: number
  handedOut: number
  receivedIn: number
  balance: number
}

export function holderBalances(pays: HolderPayment[], handovers: HolderHandover[]): { holders: HolderBalance[]; bankTotal: number } {
  const map = new Map<number, HolderBalance>()
  const get = (id: number) => {
    let h = map.get(id)
    if (!h) {
      h = { id, collected: 0, handedOut: 0, receivedIn: 0, balance: 0 }
      map.set(id, h)
    }
    return h
  }
  for (const p of pays) if (p.status === "valid" && p.receivedBy) get(p.receivedBy).collected += p.amount
  let bankTotal = 0
  for (const h of handovers) {
    if (h.status !== "valid") continue
    get(h.fromId).handedOut += h.amount
    if (h.toId) get(h.toId).receivedIn += h.amount
    else bankTotal += h.amount
  }
  const holders = [...map.values()].map((h) => ({ ...h, balance: h.collected - h.handedOut + h.receivedIn }))
  return { holders: holders.sort((a, b) => b.balance - a.balance), bankTotal }
}
