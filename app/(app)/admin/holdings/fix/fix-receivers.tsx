"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/forms/form-bits"
import { NativeSelect } from "@/components/forms/native-select"
import { METHOD_LABELS, monthLabel, receiptLabel, taka, toBn } from "@/lib/format"
import { cn } from "@/lib/utils"
import { changeReceiverAction } from "./actions"

export type FixRow = {
  id: number
  receiptNo: number
  memberNo: number
  memberName: string
  month: string
  amount: number
  method: string
  paidOn: string
  receiverId: number | null
  receiverName: string
}

/** Tick payments, pick the admin who really holds the money, apply. Every change is audited. */
export function FixReceivers({ rows, admins }: { rows: FixRow[]; admins: { id: number; name: string }[] }) {
  const router = useRouter()
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<number | "all">("all")
  const [target, setTarget] = useState<number>(admins[0]?.id ?? 0)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState<string>()
  const [pending, start] = useTransition()

  const shown = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.receiverId === filter)), [rows, filter])
  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.id))
  const pickedTotal = rows.filter((r) => picked.has(r.id)).reduce((s, r) => s + r.amount, 0)

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function apply() {
    if (picked.size === 0) return setError("অন্তত একটি জমা বাছাই করুন।")
    const who = admins.find((a) => a.id === target)?.name ?? ""
    if (!confirm(`${toBn(picked.size)}টি জমা (${taka(pickedTotal)}) এখন থেকে "${who}"-এর কাছে আছে বলে ধরা হবে। এগোবেন?`)) return
    setError(undefined)
    setDone(undefined)
    start(async () => {
      const res = await changeReceiverAction({ paymentIds: [...picked], receiverId: target })
      if (!res.ok) return setError(res.error)
      setDone(`${toBn(res.data.changed)}টি জমা বদলানো হয়েছে।`)
      setPicked(new Set())
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-muted-foreground">
        যেসব জমার গ্রহণকারী ভুল বসেছে, সেগুলো টিক দিয়ে সঠিক অ্যাডমিনের নাম বেছে &quot;বদলান&quot; চাপুন। টাকার অঙ্ক, মাস বা রসিদ বদলাবে না — শুধু &quot;কার কাছে আছে&quot; বদলাবে, আর প্রতিটা বদল অডিট লগে থাকবে।
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect className="w-auto flex-1" value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="যাঁর নামে আছে তাঁর জমা দেখুন">
          <option value="all">সব জমা ({toBn(rows.length)})</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}-এর নামে ({toBn(rows.filter((r) => r.receiverId === a.id).length)})
            </option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" onClick={() => setPicked(allShownPicked ? new Set() : new Set(shown.map((r) => r.id)))}>
          {allShownPicked ? "সব বাদ" : "এগুলো সব বাছুন"}
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-white">
        {shown.map((r) => (
          <li key={r.id}>
            <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", picked.has(r.id) && "bg-green-50")}>
              <input type="checkbox" className="size-6 shrink-0 accent-green-700" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">
                  {toBn(r.memberNo)}. {r.memberName} · {taka(r.amount)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {receiptLabel(r.receiptNo)} · {monthLabel(r.month)} · {METHOD_LABELS[r.method]}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-sm text-brand-navy">{r.receiverName}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 ? <li className="px-3 py-4 text-center text-muted-foreground">কোনো জমা নেই</li> : null}
      </ul>

      <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl border bg-white p-3 shadow-lg lg:bottom-4">
        <p className="text-sm">
          বাছাই: <b>{toBn(picked.size)}</b>টি · {taka(pickedTotal)}
        </p>
        <div className="flex gap-2">
          <NativeSelect value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="যাঁর কাছে টাকা আছে">
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}-এর কাছে
              </option>
            ))}
          </NativeSelect>
          <Button onClick={apply} disabled={pending || picked.size === 0} className="shrink-0">
            {pending ? <Loader2 className="size-5 animate-spin" /> : null} বদলান
          </Button>
        </div>
        <FormError message={error} />
        {done ? (
          <p className="flex items-center gap-1 text-sm text-green-700">
            <Check className="size-4" /> {done}
          </p>
        ) : null}
      </div>
    </div>
  )
}
