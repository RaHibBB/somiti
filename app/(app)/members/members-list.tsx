"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HandCoins, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { filterMembers } from "@/components/member-picker"
import { taka, toBn } from "@/lib/format"

export type MemberRow = {
  id: number
  no: number
  name: string
  shares: number
  paid: number
  due: number
  cancelled: boolean
}

export function MembersList({ rows, activeCount, isAdmin }: { rows: MemberRow[]; activeCount: number; isAdmin: boolean }) {
  const [query, setQuery] = useState("")
  const shown = useMemo(() => filterMembers(rows, query), [rows, query])
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="নাম বা সদস্য নম্বর" className="pl-10" />
      </div>
      <p className="text-sm text-muted-foreground">সক্রিয় সদস্য {toBn(activeCount)} জন</p>
      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {shown.map((r) => (
          <li key={r.id} className="flex items-stretch">
            <Link href={`/members/${r.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2 active:bg-muted">
              <span className="w-10 shrink-0 rounded-md bg-secondary py-1 text-center text-sm font-semibold text-brand-navy">
                {toBn(r.no)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{r.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {r.cancelled ? <span className="text-destructive">বাতিল</span> : `${toBn(r.shares)} শেয়ার`} · জমা {taka(r.paid)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {r.due > 0 ? (
                  <>
                    <span className="block text-xs text-muted-foreground">বকেয়া</span>
                    <span className="block text-base font-semibold text-destructive">{taka(r.due)}</span>
                  </>
                ) : (
                  <span className="text-sm text-green-700">✓ হালনাগাদ</span>
                )}
              </span>
            </Link>
            {isAdmin && !r.cancelled ? (
              // One tap from the list straight into “take payment” with this member selected.
              <Link
                href={`/admin/pay?member=${r.id}`}
                className="m-2 flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-white active:opacity-90"
                aria-label={`${r.name}-এর জমা নিন`}
              >
                <HandCoins className="size-5" />
                জমা
              </Link>
            ) : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">কাউকে পাওয়া যায়নি</li> : null}
      </ul>
    </div>
  )
}
