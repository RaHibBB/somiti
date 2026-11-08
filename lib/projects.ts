// Project accounts (e.g. a cow). Pure functions, unit-tested; no DB access here.
//
// Inside a project every entry is one of three kinds:
//   capital  — buying the main asset (stored as transaction type "investment")
//   cost     — running costs: feed, medicine, transport… ("expense")
//   income   — sale, milk, any money coming in ("business_income")
//
// While a project is OPEN, everything spent on it minus anything already earned is money
// "tied up" in the project: it counts as invested, not as a loss. When the project is CLOSED,
// its result (income − capital − costs) is profit or loss, counted in the samiti year of the
// closing date (see lib/profit.ts).

import type { TxnType } from "@/lib/ledger"

export type ProjectEntryKind = "capital" | "cost" | "income"

export const KIND_TO_TYPE: Record<ProjectEntryKind, TxnType> = {
  capital: "investment",
  cost: "expense",
  income: "business_income",
}

export const TYPE_TO_KIND: Partial<Record<TxnType, ProjectEntryKind>> = {
  investment: "capital",
  expense: "cost",
  business_income: "income",
}

/** Transaction types allowed inside a project (mirrors the DB check transactions_project_types). */
export const PROJECT_TXN_TYPES: TxnType[] = ["investment", "expense", "business_income"]

export const KIND_LABELS: Record<ProjectEntryKind, string> = {
  capital: "কেনা / মূলধন",
  cost: "খরচ",
  income: "আয় / বিক্রি",
}

/** Suggested headings per kind; admins can also type their own. */
export const CATEGORY_PRESETS: Record<ProjectEntryKind, string[]> = {
  capital: ["কেনা"],
  cost: ["খাবার", "ওষুধ ও ডাক্তার", "পরিবহন", "লালন-পালন / বেতন", "অন্যান্য খরচ"],
  income: ["বিক্রি", "দুধ / অন্যান্য আয়"],
}

export type ProjectTxn = { projectId?: number | null; type: TxnType; amount: number; status: "valid" | "void"; category?: string | null }

export type ProjectTotals = {
  capital: number
  costs: number
  income: number
  /** capital + costs */
  spent: number
  /** income − spent (profit when positive, loss when negative) */
  result: number
  /** Money still tied up in the project: max(0, spent − income). */
  tied: number
}

export function projectTotals(txns: ProjectTxn[]): ProjectTotals {
  let capital = 0
  let costs = 0
  let income = 0
  for (const t of txns) {
    if (t.status !== "valid") continue
    if (t.type === "investment") capital += t.amount
    else if (t.type === "expense") costs += t.amount
    else if (t.type === "business_income") income += t.amount
  }
  const spent = capital + costs
  return { capital, costs, income, spent, result: income - spent, tied: Math.max(0, spent - income) }
}

/** Valid amounts per heading (e.g. খাবার ৳১২,০০০), biggest first, for the project page. */
export function categoryBreakdown(txns: ProjectTxn[]): { kind: ProjectEntryKind; category: string; amount: number }[] {
  const map = new Map<string, { kind: ProjectEntryKind; category: string; amount: number }>()
  for (const t of txns) {
    if (t.status !== "valid") continue
    const kind = TYPE_TO_KIND[t.type]
    if (!kind) continue
    const category = t.category?.trim() || KIND_LABELS[kind]
    const key = `${kind}|${category}`
    const row = map.get(key) ?? { kind, category, amount: 0 }
    row.amount += t.amount
    map.set(key, row)
  }
  const order: ProjectEntryKind[] = ["capital", "cost", "income"]
  return [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.amount - a.amount)
}

export type ProjectEvent = { projectId: number; kind: "close" | "reopen"; eventDate: string; id: number }

/** The current state of each project from its close/reopen history (latest event wins). */
export function projectStates(events: ProjectEvent[]): Map<number, { closed: boolean; closedOn: string | null }> {
  const latest = new Map<number, ProjectEvent>()
  for (const e of events) {
    const prev = latest.get(e.projectId)
    if (!prev || e.id > prev.id) latest.set(e.projectId, e)
  }
  const out = new Map<number, { closed: boolean; closedOn: string | null }>()
  for (const [id, e] of latest) out.set(id, e.kind === "close" ? { closed: true, closedOn: e.eventDate } : { closed: false, closedOn: null })
  return out
}

/** Money tied up in all open projects (closed projects tie up nothing). */
export function tiedInOpenProjects(txns: ProjectTxn[], closedProjectIds: Set<number>): number {
  const byProject = new Map<number, ProjectTxn[]>()
  for (const t of txns) {
    if (!t.projectId || closedProjectIds.has(t.projectId)) continue
    const list = byProject.get(t.projectId) ?? []
    list.push(t)
    byProject.set(t.projectId, list)
  }
  let tied = 0
  for (const list of byProject.values()) tied += projectTotals(list).tied
  return tied
}
