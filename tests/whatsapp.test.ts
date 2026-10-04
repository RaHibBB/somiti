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

describe("monthly group message", () => {
  it("summarises collection, dues and the fund with a report link", async () => {
    const { monthlyGroupMessage } = await import("@/lib/whatsapp")
    const msg = monthlyGroupMessage({
      month: "2026-10-01",
      paidCount: 30,
      activeCount: 32,
      collected: 15000,
      expected: 16500,
      owing: [{ no: 5, name: "করিম", due: 1000 }],
      fundTotal: 20000,
      cash: 20000,
      invested: 0,
      reportUrl: "https://example.test/print/month/2026-10",
    })
    expect(msg).toContain("অক্টোবর ২০২৬ — মাসিক হিসাব")
    expect(msg).toContain("৳১৫,০০০ / ৳১৬,৫০০ (৩০/৩২ জন")
    expect(msg).toContain("• ৫. করিম — ৳১,০০০")
    expect(msg).toContain("https://example.test/print/month/2026-10")
  })
})

describe("member and notice messages", () => {
  it("summarises one member's account", async () => {
    const { accountSummaryMessage } = await import("@/lib/whatsapp")
    const msg = accountSummaryMessage({
      name: "রায়হান",
      memberNo: 14,
      shares: 2,
      sharePrice: 500,
      paid: 1500,
      due: 500,
      overdueMonths: ["2026-10-01"],
      currentOpen: 0,
      dueDay: 10,
      accountUrl: "https://example.test/members/14",
    })
    expect(msg).toContain("সদস্য নং ১৪")
    expect(msg).toContain("শেয়ার: ২টি (মাসে ৳১,০০০)")
    expect(msg).toContain("বকেয়া: ৳৫০০ (অক্টোবর ২০২৬)")
    expect(msg).toContain("https://example.test/members/14")
  })
  it("formats a notice for the group", async () => {
    const { noticeMessage } = await import("@/lib/whatsapp")
    expect(noticeMessage({ title: "সভা", body: "শুক্রবার বিকেল ৪টায়", url: "https://x.test/notices" })).toContain("*সভা*\nশুক্রবার বিকেল ৪টায়")
  })
})

describe("this month not yet paid", () => {
  it("never says 'no dues' to someone who still has to pay this month", async () => {
    const { accountSummaryMessage, upcomingReminderMessage } = await import("@/lib/whatsapp")
    const base = { name: "শরফুদ্দিন", memberNo: 1, shares: 1, sharePrice: 500, paid: 0, due: 0, overdueMonths: [], dueDay: 10, accountUrl: "https://x.test" }
    const owing = accountSummaryMessage({ ...base, currentOpen: 500 })
    expect(owing).not.toContain("কোনো বকেয়া নেই")
    expect(owing).toContain("এই মাসের চাঁদা ৳৫০০ এখনো জমা হয়নি — ১০ তারিখের মধ্যে দিন")
    expect(accountSummaryMessage({ ...base, paid: 500, currentOpen: 0 })).toContain("কোনো বকেয়া নেই")
    expect(upcomingReminderMessage({ name: "ক", month: "2026-10-01", amount: 500, dueDay: 10 })).toContain("অক্টোবর ২০২৬-এর চাঁদা ৳৫০০ এখনো জমা হয়নি")
  })
})

describe("no contradictory 'no dues' lines", () => {
  const base = { month: "2026-10-01", paidCount: 17, activeCount: 32, collected: 15500, expected: 27500, fundTotal: 15500, cash: 15500, invested: 0, reportUrl: "https://x.test" }
  it("group message: nobody overdue but 15 haven't paid → no 'no dues' line", async () => {
    const { monthlyGroupMessage } = await import("@/lib/whatsapp")
    const msg = monthlyGroupMessage({ ...base, owing: [], notYet: [{ no: 1, name: "শরফুদ্দিন" }, { no: 2, name: "ইদ্রিস মনি" }] })
    expect(msg).not.toContain("কোনো বকেয়া নেই")
    expect(msg).toContain("এই মাসের চাঁদা এখনো দেননি (২ জন): ১. শরফুদ্দিন, ২. ইদ্রিস মনি")
  })
  it("group message: everyone paid → thanks", async () => {
    const { monthlyGroupMessage } = await import("@/lib/whatsapp")
    expect(monthlyGroupMessage({ ...base, owing: [], notYet: [] })).toContain("সবাই চাঁদা পরিশোধ করেছেন")
  })
  it("receipt: a partial payment says how much of this month is left", async () => {
    const { receiptMessage } = await import("@/lib/whatsapp")
    const r = { receiptNo: 5, forMonth: "2026-10-01", amount: 500 }
    const partial = receiptMessage({ name: "ক", receipts: [r], paidOn: "2026-10-04", dueAfter: 0, currentOpenAfter: 500 })
    expect(partial).toContain("এই মাসের আরও ৳৫০০ বাকি আছে।")
    expect(partial).not.toContain("কোনো বকেয়া নেই")
    expect(receiptMessage({ name: "ক", receipts: [r], paidOn: "2026-10-04", dueAfter: 0, currentOpenAfter: 0 })).toContain("কোনো বকেয়া নেই")
  })
})

describe("login details message", () => {
  it("tells a member how to log in the first time", async () => {
    const { inviteMessage } = await import("@/lib/whatsapp")
    const withPhone = inviteMessage({ name: "রহিম", memberNo: 7, phone: "01712345678", pin: "482915", loginUrl: "https://x.test/login" })
    expect(withPhone).toContain("https://x.test/login")
    expect(withPhone).toContain("লগইন: ০১৭১২৩৪৫৬৭৮ (অথবা সদস্য নং ৭)")
    expect(withPhone).toContain("অস্থায়ী পাসওয়ার্ড: ৪৮২৯১৫")
    expect(inviteMessage({ name: "ক", memberNo: 21, phone: null, pin: "123987", loginUrl: "u" })).toContain("লগইন: সদস্য নং ২১")
  })
})
