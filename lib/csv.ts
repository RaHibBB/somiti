// Excel-friendly CSV: UTF-8 with BOM (so Bengali opens correctly), CRLF line endings,
// RFC 4180 quoting, and protection against spreadsheet formula injection.

export const BOM = "﻿"

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  let s: string
  if (value instanceof Date) s = value.toISOString()
  else if (typeof value === "object") s = JSON.stringify(value)
  else s = String(value)
  // A text cell starting with = + - @ could run as a formula in Excel; numbers are left alone.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : [])
  const lines = [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))]
  return BOM + lines.join("\r\n") + "\r\n"
}
