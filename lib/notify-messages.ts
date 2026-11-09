import { monthLabel, receiptLabel, taka } from "@/lib/format"
import type { NewNotification } from "@/lib/notify"

/** "জমা হয়েছে ৳১,০০০ — নভেম্বর ২০২৬ · রসিদ R-0069" for the member who paid. */
export function paymentNotification(memberId: number, receipts: { receiptNo: number; forMonth: string; amount: number }[]): NewNotification {
  const total = receipts.reduce((s, r) => s + r.amount, 0)
  const months = receipts.map((r) => monthLabel(r.forMonth)).join(", ")
  return {
    memberId,
    kind: "payment",
    title: `জমা হয়েছে ${taka(total)}`,
    body: `${months} · রসিদ ${receipts.map((r) => receiptLabel(r.receiptNo)).join(", ")}। ধন্যবাদ!`,
    url: `/print/receipt/${Math.min(...receipts.map((r) => r.receiptNo))}`,
  }
}
