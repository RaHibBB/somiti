// "How much does each admin hold?" — the month's own account: what was carried in from earlier
// months, what they collected this month, what went to the bank or to another admin, and what is
// still in hand. Pure functions, so pages and tests share one calculation.

export type HolderPayment = { receivedBy: number | null; amount: number; status: "valid" | "void"; paidOn: string }
export type HolderHandover = { fromId: number; toId: number | null; amount: number; status: "valid" | "void"; date: string }
export type HolderTxn = { type: string; via: "bank" | "cash"; cashHolderId: number | null; amount: number; status: "valid" | "void"; date: string }

const INFLOW = new Set(["business_income", "investment_return", "bank_profit"])
const isInflow = (t: HolderTxn) => INFLOW.has(t.type)

export type MonthHolding = {
  id: number
  /** Still in hand at the start of the month (from all earlier months). */
  opening: number
  collected: number
  toBank: number
  givenOut: number
  receivedIn: number
  /** Expenses etc. paid from this admin's cash this month. */
  spentCash: number
  /** Income received as cash into this admin's hand this month. */
  incomeCash: number
  /** opening + collected + receivedIn + incomeCash − toBank − givenOut − spentCash */
  closing: number
}

export type MonthHoldings = {
  month: string
  holders: MonthHolding[]
  collected: number
  toBank: number
  /** Everything deposited in the bank up to the end of this month. */
  bankTotal: number
  /** What the bank account holds at the end of this month: deposits + bank income − bank outflows. */
  bankBalance: number
  /** Still in admins' hands at the end of this month. */
  inHand: number
  /** Payments whose holder is unknown (old entries without a receiver) — shown so they can be fixed. */
  unknownAmount: number
}

const ym = (d: string) => d.slice(0, 7)

export function monthHoldings(pays: HolderPayment[], handovers: HolderHandover[], month: string, txns: HolderTxn[] = []): MonthHoldings {
  const m = ym(month)
  const map = new Map<number, MonthHolding>()
  const get = (id: number) => {
    let h = map.get(id)
    if (!h) {
      h = { id, opening: 0, collected: 0, toBank: 0, givenOut: 0, receivedIn: 0, spentCash: 0, incomeCash: 0, closing: 0 }
      map.set(id, h)
    }
    return h
  }
  let unknownAmount = 0
  for (const p of pays) {
    if (p.status !== "valid" || ym(p.paidOn) > m) continue
    if (!p.receivedBy) {
      if (ym(p.paidOn) === m) unknownAmount += p.amount
      continue
    }
    const h = get(p.receivedBy)
    if (ym(p.paidOn) === m) h.collected += p.amount
    else h.opening += p.amount
  }
  let bankTotal = 0
  for (const t of handovers) {
    if (t.status !== "valid" || ym(t.date) > m) continue
    const thisMonth = ym(t.date) === m
    const from = get(t.fromId)
    if (t.toId === null) bankTotal += t.amount
    if (thisMonth) {
      if (t.toId === null) from.toBank += t.amount
      else {
        from.givenOut += t.amount
        get(t.toId).receivedIn += t.amount
      }
    } else {
      from.opening -= t.amount
      if (t.toId !== null) get(t.toId).opening += t.amount
    }
  }
  let bankBalance = bankTotal
  for (const t of txns) {
    if (t.status !== "valid" || ym(t.date) > m) continue
    const signed = isInflow(t) ? t.amount : -t.amount
    if (t.via === "bank" || !t.cashHolderId) {
      bankBalance += signed
      continue
    }
    const h = get(t.cashHolderId)
    if (ym(t.date) === m) {
      if (signed > 0) h.incomeCash += t.amount
      else h.spentCash += t.amount
    } else h.opening += signed
  }
  const holders = [...map.values()]
    .map((h) => ({ ...h, closing: h.opening + h.collected + h.receivedIn + h.incomeCash - h.toBank - h.givenOut - h.spentCash }))
    .filter((h) => h.opening || h.collected || h.toBank || h.givenOut || h.receivedIn || h.spentCash || h.incomeCash)
    .sort((a, b) => b.closing - a.closing || b.collected - a.collected)
  return {
    month: `${m}-01`,
    holders,
    collected: holders.reduce((s, h) => s + h.collected, 0),
    toBank: holders.reduce((s, h) => s + h.toBank, 0),
    bankTotal,
    bankBalance,
    inHand: holders.reduce((s, h) => s + h.closing, 0),
    unknownAmount,
  }
}

/** Current balances (all months) — what each admin holds right now. */
export function holderBalances(pays: HolderPayment[], handovers: HolderHandover[], txns: HolderTxn[] = []): { holders: { id: number; balance: number }[]; bankTotal: number } {
  const r = monthHoldings(pays, handovers, "9999-12", txns)
  return { holders: r.holders.map((h) => ({ id: h.id, balance: h.closing })), bankTotal: r.bankTotal }
}
