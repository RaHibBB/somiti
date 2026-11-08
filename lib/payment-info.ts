/**
 * Where members send money (samiti decisions, 2026-11-08). Client-safe: no secrets here.
 * The bKash number is the samiti's public contact number. The bank account is NOT kept in
 * the (public) repository — it comes from environment variables, see `lib/bank.ts`.
 */
export const BKASH_NUMBER = "01859336893"
export const BKASH_LABEL = "বিকাশ (Personal)"

export type BankAccount = {
  bank: string
  branch: string
  accountName: string
  accountNo: string
  routingNo: string | null
}

/** Short lines for WhatsApp reminders: bKash, and the bank account when one is configured. */
export function payLine(bank: BankAccount | null): string {
  return [
    `💳 ${BKASH_LABEL}: ${BKASH_NUMBER}`,
    ...(bank
      ? [`🏦 ${bank.bank} — A/C ${bank.accountNo} (${bank.accountName}, ${bank.branch}${bank.routingNo ? `, Routing ${bank.routingNo}` : ""})`]
      : []),
    'পাঠিয়ে ট্রানজেকশন নম্বর বা স্ক্রিনশট জানাবেন, অথবা অ্যাপে "টাকা দিন" পাতায় লিখে দিন।',
  ].join("\n")
}

/** The admins' standing instruction for the group, word for word, plus the bank account. */
export function paymentNotice(bank: BankAccount | null): string {
  return [
    "সমিতির যেকোনো আর্থিক লেনদেনের জন্য নিচের নম্বরে টাকা পাঠানোর অনুরোধ করা হলো। টাকা পাঠানোর পর অবশ্যই ট্রানজেকশন/স্ক্রিনশট গ্রুপে জানাবেন।",
    `💳 ${BKASH_LABEL}: ${BKASH_NUMBER}`,
    ...(bank
      ? [
          `🏦 ব্যাংক: ${bank.bank}, ${bank.branch}`,
          `   A/C Name: ${bank.accountName}`,
          `   A/C No: ${bank.accountNo}`,
          ...(bank.routingNo ? [`   Routing No: ${bank.routingNo}`] : []),
        ]
      : []),
    "ধন্যবাদ। সবাই নিয়ম মেনে সমিতির কার্যক্রমে সহযোগিতা করবেন।",
  ].join("\n")
}
