import { describe, expect, it } from "vitest"
import { formatDate, monthLabel, monthShort, receiptLabel, taka, toBn, fromBn, dhakaDateString } from "@/lib/format"

describe("format helpers", () => {
  it("converts digits to Bengali and back", () => {
    expect(toBn(2026)).toBe("২০২৬")
    expect(fromBn("০১৮৫৯")).toBe("01859")
  })
  it("formats taka with Indian grouping", () => {
    expect(taka(500)).toBe("৳৫০০")
    expect(taka(1234567)).toBe("৳১২,৩৪,৫৬৭")
    expect(taka(-350)).toBe("−৳৩৫০")
  })
  it("formats dates dd/mm/yyyy", () => {
    expect(formatDate("2026-10-05")).toBe("০৫/১০/২০২৬")
  })
  it("labels months and receipts", () => {
    expect(monthLabel("2026-10-01")).toBe("অক্টোবর ২০২৬")
    expect(receiptLabel(12)).toBe("R-0012")
    expect(monthShort("2026-10-01")).toBe("অক্টো ২৬")
  })
  it("uses Asia/Dhaka for the calendar day", () => {
    // 2026-10-09 20:00 UTC is already 10 Oct in Dhaka (UTC+6)
    expect(dhakaDateString(new Date("2026-10-09T20:00:00Z"))).toBe("2026-10-10")
  })
})
