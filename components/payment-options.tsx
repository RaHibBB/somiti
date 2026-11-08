import Link from "next/link"
import { ChevronRight, Landmark, Smartphone } from "lucide-react"
import { CopyButton } from "@/components/copy-button"
import { getBank } from "@/lib/bank"
import { BKASH_LABEL, BKASH_NUMBER } from "@/lib/payment-info"

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={mono ? "font-mono text-lg font-bold tracking-wide break-all select-all" : "text-base font-semibold"}>{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  )
}

/** The samiti's bKash number and bank account, with copy buttons, for paying from a phone. */
export function PaymentOptions({ compact = false }: { compact?: boolean }) {
  const bank = getBank()
  if (compact) {
    return (
      <Link href="/report" className="block space-y-1 rounded-xl border-2 border-[#e2136e] bg-white p-3 active:bg-pink-50">
        <p className="flex items-center justify-between text-sm font-medium text-[#b10f57]">
          <span className="flex items-center gap-1.5">
            <Smartphone className="size-4" /> {BKASH_LABEL}
          </span>
          <ChevronRight className="size-4" />
        </p>
        <p className="font-mono text-2xl font-bold tracking-wider">{BKASH_NUMBER}</p>
        {bank ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Landmark className="size-4 shrink-0" /> অথবা ব্যাংক: <span className="font-mono">{bank.accountNo}</span>
          </p>
        ) : null}
      </Link>
    )
  }
  return (
    <div className="space-y-3">
      <section className="rounded-xl border-2 border-[#e2136e] bg-white p-3">
        <p className="flex items-center gap-1.5 text-base font-semibold text-[#b10f57]">
          <Smartphone className="size-5" /> {BKASH_LABEL} — Send Money
        </p>
        <Row label="বিকাশ নম্বর" value={BKASH_NUMBER} />
      </section>

      {bank ? (
        <section className="rounded-xl border-2 border-brand-navy/40 bg-white p-3">
          <p className="flex items-center gap-1.5 text-base font-semibold text-brand-navy">
            <Landmark className="size-5" /> ব্যাংক — {bank.bank}
          </p>
          <p className="text-sm text-muted-foreground">{bank.branch}</p>
          <div className="divide-y">
            <Row label="অ্যাকাউন্ট নম্বর (A/C No)" value={bank.accountNo} />
            <Row label="অ্যাকাউন্টের নাম (A/C Name)" value={bank.accountName} mono={false} />
            {bank.routingNo ? <Row label="রাউটিং নম্বর (অন্য ব্যাংক থেকে পাঠালে)" value={bank.routingNo} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
