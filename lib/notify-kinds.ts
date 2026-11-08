// Notification kinds, shared by the server (who gets what) and the settings page (opt-outs).
// Client-safe: no DB access here.

export const NOTIFY_KINDS = {
  payment: { label: "আমার জমা হলে (রসিদ নম্বরসহ)", admin: false },
  due: { label: "চাঁদা দেওয়ার কথা মনে করানো (৮ তারিখ) ও বকেয়া হলে (১১ তারিখ)", admin: false },
  report: { label: "আমার জানানো বিকাশ/ব্যাংক জমা অনুমোদন বা বাতিল হলে", admin: false },
  notice: { label: "নতুন নোটিশ", admin: false },
  vote: { label: "নতুন ভোট শুরু ও ভোট শেষের আগের দিন", admin: false },
  admin: { label: "অ্যাডমিন: সদস্য জমা জানালে, মাস শেষে হাতে টাকা থাকলে", admin: true },
} as const

export type NotifyKind = keyof typeof NOTIFY_KINDS

export const NOTIFY_KIND_KEYS = Object.keys(NOTIFY_KINDS) as NotifyKind[]

export function isNotifyKind(s: string): s is NotifyKind {
  return s in NOTIFY_KINDS
}
