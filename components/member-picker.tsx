"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { fromBn, toBn } from "@/lib/format"

export type PickerMember = { id: number; no: number; name: string; right?: React.ReactNode }

export function filterMembers<T extends { no: number; name: string }>(list: T[], query: string): T[] {
  const q = fromBn(query.trim()).toLowerCase()
  if (!q) return list
  if (/^\d+$/.test(q)) return list.filter((m) => String(m.no).startsWith(q))
  return list.filter((m) => m.name.toLowerCase().includes(q))
}

/** Searchable member list (name or member number, Bengali or ASCII digits). */
export function MemberPicker({
  members,
  onSelect,
  autoFocus,
}: {
  members: PickerMember[]
  onSelect: (id: number) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState("")
  const shown = useMemo(() => filterMembers(members, query), [members, query])
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="নাম বা সদস্য নম্বর লিখুন"
          className="pl-10"
          autoFocus={autoFocus}
          aria-label="সদস্য খুঁজুন"
        />
      </div>
      <ul className="max-h-[60dvh] divide-y overflow-y-auto rounded-xl border bg-white">
        {shown.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              className="flex min-h-14 w-full items-center gap-3 px-3 text-left active:bg-muted"
            >
              <span className="w-10 shrink-0 rounded-md bg-secondary py-1 text-center text-sm font-semibold text-brand-navy">
                {toBn(m.no)}
              </span>
              <span className="min-w-0 flex-1 truncate text-base">{m.name}</span>
              {m.right}
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">কাউকে পাওয়া যায়নি</li> : null}
      </ul>
    </div>
  )
}
