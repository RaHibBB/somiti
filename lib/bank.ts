import "server-only"
import type { BankAccount } from "@/lib/payment-info"

/**
 * The samiti's bank account, from environment variables (set in Vercel → Settings →
 * Environment Variables, and in .env.local for local dev). Kept out of the repository,
 * which is public. Returns null when not configured; the app then shows bKash only.
 */
export function getBank(): BankAccount | null {
  const bank = process.env.BANK_NAME?.trim()
  const branch = process.env.BANK_BRANCH?.trim()
  const accountName = process.env.BANK_ACCOUNT_NAME?.trim()
  const accountNo = process.env.BANK_ACCOUNT_NO?.trim()
  if (!bank || !branch || !accountName || !accountNo) return null
  return { bank, branch, accountName, accountNo, routingNo: process.env.BANK_ROUTING_NO?.trim() || null }
}
