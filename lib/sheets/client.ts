import "server-only"
import { importPKCS8, SignJWT } from "jose"
import { HEADERS, SHEET_NOTE, type Row, type TabName } from "./rows"

/**
 * A tiny Google Sheets v4 client over plain fetch. It replaces the `googleapis` package,
 * which pulled ~13 MB into every server function (and slowed cold starts) for the handful
 * of calls below. Auth is a service-account JWT exchanged for an access token.
 */
export type SheetsApi = { token: string }

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const BASE = "https://sheets.googleapis.com/v4/spreadsheets"

/** null when GOOGLE_SERVICE_ACCOUNT_JSON / SHEET_ID aren't configured (e.g. local dev). */
export async function getSheetsApi(): Promise<{ api: SheetsApi; sheetId: string } | null> {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const sheetId = process.env.SHEET_ID
  if (!encoded || !sheetId) return null
  const creds = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { client_email: string; private_key: string }
  const key = await importPKCS8(creds.private_key, "RS256")
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key)
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  })
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`)
  const { access_token } = (await res.json()) as { access_token: string }
  return { api: { token: access_token }, sheetId }
}

async function call<T>(api: SheetsApi, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { authorization: `Bearer ${api.token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Sheets API ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

const q = (s: string) => encodeURIComponent(s)

/** Read several ranges at once (used by the one-time import script). */
export async function readRanges(api: SheetsApi, sheetId: string, ranges: string[]): Promise<string[][][]> {
  const qs = ranges.map((r) => `ranges=${q(r)}`).join("&")
  const res = await call<{ valueRanges?: { values?: unknown[][] }[] }>(api, "GET", `${sheetId}/values:batchGet?${qs}&valueRenderOption=FORMATTED_VALUE`)
  return (res.valueRanges ?? []).map((v) => (v.values ?? []).map((r) => r.map(String)))
}

/** Create any missing tabs, each with the read-only note in row 1 and headers in row 2. */
export async function ensureTabs(api: SheetsApi, sheetId: string, tabs: TabName[]) {
  const meta = await call<{ sheets?: { properties?: { title?: string } }[] }>(api, "GET", `${sheetId}?fields=sheets.properties.title`)
  const existing = new Set(meta.sheets?.map((s) => s.properties?.title) ?? [])
  const missing = tabs.filter((t) => !existing.has(t))
  if (missing.length === 0) return
  await call(api, "POST", `${sheetId}:batchUpdate`, {
    requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 2 } } } })),
  })
  await call(api, "POST", `${sheetId}/values:batchUpdate`, {
    valueInputOption: "RAW",
    data: missing.map((t) => ({ range: `'${t}'!A1`, values: [[SHEET_NOTE], HEADERS[t]] })),
  })
}

/** Replace a whole tab: note, headers, then all rows. */
export async function rewriteTab(api: SheetsApi, sheetId: string, tab: TabName, rows: Row[]) {
  await call(api, "POST", `${sheetId}/values/${q(`'${tab}'`)}:clear`, {})
  await call(api, "PUT", `${sheetId}/values/${q(`'${tab}'!A1`)}?valueInputOption=RAW`, {
    values: [[SHEET_NOTE], HEADERS[tab], ...rows],
  })
}

/**
 * Update rows in place by id (column A, data from row 3) and append the rest.
 * Voiding a payment therefore flips its existing row to "বাতিল" instead of adding a duplicate.
 */
export async function upsertRows(api: SheetsApi, sheetId: string, tab: TabName, rows: Row[]) {
  if (rows.length === 0) return
  const res = await call<{ values?: unknown[][] }>(api, "GET", `${sheetId}/values/${q(`'${tab}'!A3:A`)}`)
  const rowOf = new Map<string, number>()
  ;(res.values ?? []).forEach((v, i) => {
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
    await call(api, "POST", `${sheetId}/values:batchUpdate`, { valueInputOption: "RAW", data: updates })
  }
  if (appends.length) {
    await call(api, "POST", `${sheetId}/values/${q(`'${tab}'!A3`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      values: appends,
    })
  }
}
