import "server-only"
import type { sheets_v4 } from "googleapis"
import { HEADERS, SHEET_NOTE, type Row, type TabName } from "./rows"

export type SheetsApi = sheets_v4.Sheets

/** null when GOOGLE_SERVICE_ACCOUNT_JSON / SHEET_ID aren't configured (e.g. local dev). */
export async function getSheetsApi(): Promise<{ api: SheetsApi; sheetId: string } | null> {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const sheetId = process.env.SHEET_ID
  if (!encoded || !sheetId) return null
  const creds = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { client_email: string; private_key: string }
  // Loaded lazily: googleapis is large and only needed when syncing.
  const { google } = await import("googleapis")
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return { api: google.sheets({ version: "v4", auth }), sheetId }
}

/** Create any missing tabs, each with the read-only note in row 1 and headers in row 2. */
export async function ensureTabs(api: SheetsApi, sheetId: string, tabs: TabName[]) {
  const meta = await api.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties.title" })
  const existing = new Set(meta.data.sheets?.map((s) => s.properties?.title) ?? [])
  const missing = tabs.filter((t) => !existing.has(t))
  if (missing.length === 0) return
  await api.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 2 } } } })) },
  })
  await api.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: missing.map((t) => ({ range: `'${t}'!A1`, values: [[SHEET_NOTE], HEADERS[t]] })),
    },
  })
}

/** Replace a whole tab: note, headers, then all rows. */
export async function rewriteTab(api: SheetsApi, sheetId: string, tab: TabName, rows: Row[]) {
  await api.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `'${tab}'` })
  await api.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${tab}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[SHEET_NOTE], HEADERS[tab], ...rows] },
  })
}

/**
 * Update rows in place by id (column A, data from row 3) and append the rest.
 * Voiding a payment therefore flips its existing row to "বাতিল" instead of adding a duplicate.
 */
export async function upsertRows(api: SheetsApi, sheetId: string, tab: TabName, rows: Row[]) {
  if (rows.length === 0) return
  const res = await api.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${tab}'!A3:A` })
  const rowOf = new Map<string, number>()
  ;(res.data.values ?? []).forEach((v, i) => {
    if (v[0] !== undefined && v[0] !== "") rowOf.set(String(v[0]), i + 3)
  })
  const updates: { range: string; values: Row[] }[] = []
  const appends: Row[] = []
  for (const row of rows) {
    const at = rowOf.get(String(row[0]))
    if (at) updates.push({ range: `'${tab}'!A${at}`, values: [row] })
    else appends.push(row)
  }
  if (updates.length) {
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    })
  }
  if (appends.length) {
    await api.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tab}'!A3`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends },
    })
  }
}
