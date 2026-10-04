import { cn } from "@/lib/utils"

const LABEL: Record<string, string> = {
  draft: "খসড়া",
  open: "ভোট চলছে",
  passed: "পাস হয়েছে",
  rejected: "বাতিল (না-ভোট)",
  invalid: "অবৈধ (ভোট কম)",
}

const CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  open: "bg-blue-100 text-blue-800",
  passed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  invalid: "bg-amber-100 text-amber-900",
}

export function ProposalBadge({ status }: { status: string }) {
  return <span className={cn("rounded-md px-2 py-0.5 text-sm whitespace-nowrap", CLASS[status])}>{LABEL[status] ?? status}</span>
}
