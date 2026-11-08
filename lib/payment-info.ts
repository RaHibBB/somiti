/** Where members send money (samiti decision, 2026-11-08). Shown on the report page, the home page and in reminders. */
export const BKASH_NUMBER = "01859336893"
export const BKASH_LABEL = "বিকাশ (Personal)"

/** The admins' standing instruction, word for word as agreed in the group. */
export const PAYMENT_NOTICE = [
  "সমিতির যেকোনো আর্থিক লেনদেনের জন্য নিচের নম্বরে টাকা পাঠানোর অনুরোধ করা হলো। টাকা পাঠানোর পর অবশ্যই ট্রানজেকশন/স্ক্রিনশট গ্রুপে জানাবেন।",
  `💳 ${BKASH_LABEL}: ${BKASH_NUMBER}`,
  "ধন্যবাদ। সবাই নিয়ম মেনে সমিতির কার্যক্রমে সহযোগিতা করবেন।",
].join("\n")

/** One line for WhatsApp reminders. */
export const PAY_LINE = `💳 ${BKASH_LABEL}: ${BKASH_NUMBER} — পাঠিয়ে ট্রানজেকশন নম্বর বা স্ক্রিনশট জানাবেন।`
