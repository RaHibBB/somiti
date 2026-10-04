import { describe, expect, it } from "vitest"
import {
  generatePin,
  isValidPassword,
  isWeakPassword,
  normalizeEmail,
  normalizePhone,
  parseIdentifier,
} from "@/lib/auth/pin"

describe("login identifiers", () => {
  it("normalises phone numbers", () => {
    expect(normalizePhone("01859336893")).toBe("01859336893")
    expect(normalizePhone("+8801859336893")).toBe("01859336893")
    expect(normalizePhone("8801859336893")).toBe("01859336893")
    expect(normalizePhone("০১৮৫৯-৩৩৬৮৯৩")).toBe("01859336893")
    expect(normalizePhone("0185933689")).toBeNull()
    expect(normalizePhone("01259336893")).toBeNull()
  })
  it("normalises emails", () => {
    expect(normalizeEmail("  Rahim@Example.COM ")).toBe("rahim@example.com")
    expect(normalizeEmail("not-an-email")).toBeNull()
    expect(normalizeEmail("a@b")).toBeNull()
  })
  it("parses email, member numbers and phones", () => {
    expect(parseIdentifier("Rahim@Gmail.com")).toEqual({ kind: "email", email: "rahim@gmail.com" })
    expect(parseIdentifier("12")).toEqual({ kind: "memberNo", memberNo: 12 })
    expect(parseIdentifier("১২")).toEqual({ kind: "memberNo", memberNo: 12 })
    expect(parseIdentifier("01859336893")).toEqual({ kind: "phone", phone: "01859336893" })
    expect(parseIdentifier("0")).toBeNull()
    expect(parseIdentifier("abc")).toBeNull()
    expect(parseIdentifier("bad@")).toBeNull()
  })
})

describe("passwords", () => {
  it("accepts 6–64 characters of anything", () => {
    expect(isValidPassword("12345")).toBe(false)
    expect(isValidPassword("246810")).toBe(true) // old 6-digit PINs still valid
    expect(isValidPassword("আমার পাসওয়ার্ড")).toBe(true)
    expect(isValidPassword("x".repeat(65))).toBe(false)
  })
  it("detects weak passwords", () => {
    expect(isWeakPassword("111111")).toBe(true)
    expect(isWeakPassword("aaaaaaaa")).toBe(true)
    expect(isWeakPassword("123456")).toBe(true)
    expect(isWeakPassword("12345678")).toBe(true)
    expect(isWeakPassword("654321")).toBe(true)
    expect(isWeakPassword("Password")).toBe(true)
    expect(isWeakPassword("482915")).toBe(false)
    expect(isWeakPassword("mirsarai-2026")).toBe(false)
  })
  it("generates valid temporary passwords", () => {
    for (let i = 0; i < 200; i++) {
      const pin = generatePin()
      expect(pin).toMatch(/^\d{6}$/)
      expect(isWeakPassword(pin)).toBe(false)
    }
  })
})

describe("post-login redirect", () => {
  it("only allows same-site paths", async () => {
    const { safeNext } = await import("@/lib/auth/next-path")
    expect(safeNext("/report")).toBe("/report")
    expect(safeNext("/admin/pay?member=3")).toBe("/admin/pay?member=3")
    expect(safeNext("//evil.com")).toBe("/")
    expect(safeNext("https://evil.com")).toBe("/")
    expect(safeNext("/\\evil.com")).toBe("/") // browsers treat "/\" like "//"
    expect(safeNext("/members/3")).toBe("/members/3")
    expect(safeNext(undefined)).toBe("/")
  })
})
