import { describe, expect, it } from "vitest"
import { BOM, toCsv } from "@/lib/csv"

describe("csv", () => {
  it("starts with a BOM and uses CRLF", () => {
    const csv = toCsv([{ a: 1, b: "নাম" }])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toBe(BOM + "a,b\r\n1,নাম\r\n")
  })
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([{ x: 'a,"b"\nc' }])).toBe(BOM + 'x\r\n"a,""b""\nc"\r\n')
  })
  it("neutralises formula injection in text but not numbers", () => {
    expect(toCsv([{ t: "=HYPERLINK(1)", n: -5 }])).toBe(BOM + "t,n\r\n'=HYPERLINK(1),-5\r\n")
  })
  it("serialises dates, json and nulls", () => {
    const csv = toCsv([{ d: new Date("2026-10-01T00:00:00Z"), j: { a: 1 }, z: null }])
    expect(csv).toBe(BOM + 'd,j,z\r\n2026-10-01T00:00:00.000Z,"{""a"":1}",\r\n')
  })
})
