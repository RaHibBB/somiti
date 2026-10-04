import { describe, expect, it } from "vitest"
import { receiptMessage, reminderMessage, waLink } from "@/lib/whatsapp"

describe("whatsapp links", () => {
  it("adds the country code and encodes the text", () => {
    expect(waLink("01712345678", "হ্যালো")).toBe("https://wa.me/8801712345678?text=" + encodeURIComponent("হ্যালো"))
    expect(waLink(null, "x")).toBe("https://wa.me/?text=x")
  })
  it("builds a receipt message", () => {
    const msg = receiptMessage({
      name: "রহিম",
      receipts: [{ receiptNo: 12, forMonth: "2026-10-01", amount: 1000 }],
      paidOn: "2026-10-05",
      dueAfter: 0,
    })
    expect(msg).toContain("রসিদ R-0012")
    expect(msg).toContain("অক্টোবর ২০২৬ — ৳১,০০০")
    expect(msg).toContain("০৫/১০/২০২৬")
    expect(msg).toContain("কোনো বকেয়া নেই")
  })
  it("builds a reminder with amount and months", () => {
    const msg = reminderMessage({ name: "করিম", due: 1500, months: ["2026-10-01", "2026-11-01"], dueDay: 10 })
    expect(msg).toContain("২ মাসের")
    expect(msg).toContain("অক্টোবর ২০২৬, নভেম্বর ২০২৬")
    expect(msg).toContain("৳১,৫০০")
  })
})
