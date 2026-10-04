"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { fromBn, taka, toBn } from "@/lib/format"
import { cashPctAfterInvestment } from "@/lib/profit"

export function parseAmount(s: string): number {
  const n = Number(fromBn(s).replace(/[,\s৳]/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Live 70/30 check: cash share of the fund after spending `amount` on an investment. */
export function InvestmentImpact({
  cash,
  invested,
  minCashPct,
  amount,
}: {
  cash: number
  invested: number
  minCashPct: number
  amount: number
}) {
  if (!amount) return null
  const after = cashPctAfterInvestment(cash, invested, amount)
  const ok = after >= minCashPct && amount <= cash
  return (
    <div className={ok ? "rounded-lg bg-green-50 p-3 text-sm text-green-900" : "rounded-lg bg-amber-100 p-3 text-sm text-amber-950"}>
      <p className="flex items-center gap-1 font-semibold">
        {ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        বিনিয়োগের পর নগদ থাকবে {taka(Math.max(0, cash - amount))} ({toBn(after)}%)
      </p>
      <p className="mt-1">
        {amount > cash
          ? `এই পরিমাণ বর্তমান নগদ (${taka(cash)})-এর চেয়ে বেশি।`
          : ok
            ? `নিয়ম মানা হচ্ছে: কমপক্ষে ${toBn(minCashPct)}% নগদ থাকবে।`
            : `নিয়ম অনুযায়ী মোট তহবিলের কমপক্ষে ${toBn(minCashPct)}% নগদ রাখতে হবে। এটি নিয়মের বাইরে।`}
      </p>
    </div>
  )
}
