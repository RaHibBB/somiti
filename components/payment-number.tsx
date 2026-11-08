import { Smartphone } from "lucide-react"
import { BKASH_LABEL, BKASH_NUMBER } from "@/lib/payment-info"
import { toBn } from "@/lib/format"

/** The samiti's bKash number, big enough to read and copy from a phone. */
export function PaymentNumber({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-[#e2136e] bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-[#b10f57]">
        <Smartphone className="size-4" /> টাকা পাঠানোর নম্বর — {BKASH_LABEL}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-foreground select-all">{BKASH_NUMBER}</p>
      {compact ? null : (
        <p className="mt-1 text-sm text-muted-foreground">
          টাকা পাঠানোর পর অবশ্যই ট্রানজেকশন নম্বর বা স্ক্রিনশট গ্রুপে জানাবেন, অথবা নিচের ফর্মে লিখে দিন। {toBn(1)}ম বার পাঠানোর আগে নম্বরটা মিলিয়ে নিন।
        </p>
      )}
    </div>
  )
}
