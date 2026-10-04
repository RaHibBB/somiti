// One-time import from the samiti's existing Google Sheet (spec §11). Run locally.
//
//   pnpm import:sheet                     dry run: read the sheet, print a report, write nothing
//   pnpm import:sheet --commit            import into DATABASE_URL (refuses if flagged problems remain)
//   pnpm import:sheet --commit --force    import anyway: flagged payments are skipped, members with
//                                         >5 shares are imported WITHOUT shares (admins must set them)
// Sources (default: public CSV export, which works while the sheet is link-readable):
//   --source=api         read with the service account (GOOGLE_SERVICE_ACCOUNT_JSON)
//   --from-dir=./export  read members.csv, payments.csv, transactions.csv from a folder
//
// Initial PINs are printed ONCE at the end of a commit. Hand them out, then clear the terminal.
import "dotenv/config"
import { readFile } from "node:fs/promises"
import path from "node:path"
import bcrypt from "bcryptjs"
import { count } from "drizzle-orm"
import { generatePin } from "@/lib/auth/pin"
import { getDb } from "@/lib/db"
import { auditLog, members, payments, settings, shareHistory, transactions } from "@/lib/db/schema"
import { dhakaDateString } from "@/lib/format"
import { expectedForMember, paidForMember } from "@/lib/ledger"
import {
  parseCsv,
  parseMembers,
  parsePayments,
  parseTransactions,
  type Flag,
  type ImportMember,
  type ImportPayment,
  type ImportTransaction,
} from "@/lib/import/parse"

const SOURCE_SHEET_ID = "1dNE_p2ppkKP7ZZ9O_yw2xJA57FQ5A-aKsbFk-t_HF9g"
const TABS = { members: "সদস্য তালিকা", payments: "জমা খাতা", transactions: "আয়-ব্যয় ও বিনিয়োগ" } as const

const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")

async function readTabsPublic(): Promise<Record<keyof typeof TABS, string[][]>> {
  const out = {} as Record<keyof typeof TABS, string[][]>
  for (const [key, tab] of Object.entries(TABS) as [keyof typeof TABS, string][]) {
    const url = `https://docs.google.com/spreadsheets/d/${SOURCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok || text.trimStart().startsWith("<")) {
      throw new Error(`Could not read tab "${tab}" publicly (HTTP ${res.status}). Use --source=api or --from-dir.`)
    }
    out[key] = parseCsv(text)
  }
  return out
}

async function readTabsApi(): Promise<Record<keyof typeof TABS, string[][]>> {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!encoded) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  const creds = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))
  const { google } = await import("googleapis")
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })
  const api = google.sheets({ version: "v4", auth })
  const res = await api.spreadsheets.values.batchGet({
    spreadsheetId: SOURCE_SHEET_ID,
    ranges: Object.values(TABS).map((t) => `'${t}'`),
    valueRenderOption: "FORMATTED_VALUE",
  })
  const [m, p, t] = (res.data.valueRanges ?? []).map((v) => (v.values ?? []).map((r) => r.map(String)))
  return { members: m ?? [], payments: p ?? [], transactions: t ?? [] }
}

async function readTabsDir(dir: string): Promise<Record<keyof typeof TABS, string[][]>> {
  const read = async (f: string) => parseCsv(await readFile(path.join(dir, f), "utf8"))
  return { members: await read("members.csv"), payments: await read("payments.csv"), transactions: await read("transactions.csv") }
}

function printFlags(flags: Flag[]) {
  const order = { block: 0, warn: 1, info: 2 } as const
  const label = { block: "✗ সমাধান দরকার", warn: "! খেয়াল করুন", info: "· তথ্য" } as const
  for (const sev of ["block", "warn", "info"] as const) {
    const list = flags.filter((f) => f.severity === sev)
    if (!list.length) continue
    console.log(`\n${label[sev]} (${list.length})`)
    for (const f of list.sort((a, b) => order[a.severity] - order[b.severity])) console.log(`  [${f.where}] ${f.message}`)
  }
}

function printPreview(ms: ImportMember[], ps: ImportPayment[], ts: ImportTransaction[], startMonth: string, today: string) {
  const ls = { sharePrice: 500, startMonth, dueDay: 10, termMonths: 36 }
  console.log(`\nসদস্য: ${ms.length} (অ্যাডমিন ${ms.filter((m) => m.role === "admin").length}) · জমা: ${ps.length} · আয়-ব্যয়: ${ts.length}`)
  console.log(`\nহিসাব (আজ ${today} পর্যন্ত):`)
  console.log("  নং  শেয়ার  দেয়      জমা      বকেয়া   নাম")
  for (const m of ms) {
    const mine = ps.filter((p) => p.memberNo === m.memberNo)
    const history = m.shares ? [{ id: 1, shares: m.shares, effectiveMonth: startMonth }] : []
    const expected = expectedForMember(history, today, ls)
    const paid = paidForMember(mine.map((p) => ({ forMonth: p.forMonth, amount: p.amount, status: "valid" as const })))
    const pad = (v: string | number, n: number) => String(v).padStart(n)
    console.log(
      `  ${pad(m.memberNo, 3)} ${pad(m.shares ?? "?", 5)} ${pad(expected, 8)} ${pad(paid, 8)} ${pad(Math.max(0, expected - paid), 8)}   ${m.nameBn}${m.role === "admin" ? " (অ্যাডমিন)" : ""}`,
    )
  }
  const total = ps.reduce((s, p) => s + p.amount, 0)
  console.log(`\nমোট জমা: ৳${total}`)
}

async function commit(ms: ImportMember[], ps: ImportPayment[], ts: ImportTransaction[], startMonth: string) {
  const db = getDb()
  const [{ n }] = await db.select({ n: count() }).from(members)
  if (n > 0) throw new Error(`The database already has ${n} members. The import is one-time only and will not run twice.`)

  // Hash PINs before opening the transaction (bcrypt is slow).
  const pins = new Map<number, string>()
  const hashes = new Map<number, string>()
  for (const m of ms) {
    const pin = generatePin()
    pins.set(m.memberNo, pin)
    hashes.set(m.memberNo, await bcrypt.hash(pin, 10))
  }

  await db.transaction(async (tx) => {
    const idByNo = new Map<number, number>()
    for (const m of ms) {
      const [row] = await tx
        .insert(members)
        .values({
          memberNo: m.memberNo,
          nameBn: m.nameBn,
          phone: m.phone,
          role: m.role,
          status: m.status,
          joinedOn: m.joinedOn ?? startMonth,
          nomineeName: m.nomineeName,
          nomineePhone: m.nomineePhone,
          notes: m.notes,
          pinHash: hashes.get(m.memberNo)!,
          mustChangePin: true,
          cancelledAt: m.status === "cancelled" ? new Date() : null,
        })
        .returning({ id: members.id })
      idByNo.set(m.memberNo, row.id)
      if (m.shares) await tx.insert(shareHistory).values({ memberId: row.id, shares: m.shares, effectiveMonth: startMonth })
    }
    // Receipt numbers follow the payment date.
    const ordered = [...ps].sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.row - b.row)
    for (const p of ordered) {
      await tx.insert(payments).values({
        memberId: idByNo.get(p.memberNo)!,
        forMonth: p.forMonth,
        amount: p.amount,
        paidOn: p.paidOn,
        method: p.method,
        trxId: p.trxId,
        note: p.note,
      })
    }
    for (const t of ts) {
      await tx.insert(transactions).values({
        date: t.date,
        type: t.type,
        description: t.description,
        amount: t.amount,
        approvedBy: t.approvedBy,
        meetingDate: t.meetingDate,
        voteResult: t.voteResult,
        receiptUrl: null,
      })
    }
    await tx.insert(auditLog).values({
      actorId: null,
      action: "import",
      tableName: "members,payments,transactions",
      rowId: null,
      after: { source: SOURCE_SHEET_ID, members: ms.length, payments: ps.length, transactions: ts.length },
    })
  })

  console.log("\n✓ ইমপোর্ট সম্পন্ন।")
  console.log("\nপ্রাথমিক পিন (শুধু একবার দেখানো হচ্ছে — সদস্যদের দিয়ে দিন, তারপর টার্মিনাল মুছে ফেলুন):")
  console.log("  নং   পিন     নাম")
  for (const m of ms) console.log(`  ${String(m.memberNo).padStart(3)}  ${pins.get(m.memberNo)}  ${m.nameBn}${m.phone ? "" : "  (মোবাইল নেই — সদস্য নং দিয়ে লগইন)"}`)
  console.log("\nএরপর: ওয়েবসাইটের /admin/export থেকে \"Google Sheet এখনই পুরো আপডেট করুন\" চাপুন।")
}

async function main() {
  const dir = opt("from-dir")
  const source = dir ? "dir" : (opt("source") ?? "public")
  console.log(`উৎস: ${source === "dir" ? dir : source === "api" ? "Sheets API (service account)" : "পাবলিক CSV এক্সপোর্ট"}`)
  const tabs = dir ? await readTabsDir(dir) : source === "api" ? await readTabsApi() : await readTabsPublic()

  const flags: Flag[] = []
  const ms = parseMembers(tabs.members, flags)
  const ps = parsePayments(tabs.payments, new Set(ms.map((m) => m.memberNo)), flags)
  const ts = parseTransactions(tabs.transactions, flags)

  let startMonth = "2026-10-01"
  if (process.env.DATABASE_URL) {
    const [s] = await getDb().select().from(settings).limit(1)
    if (s) startMonth = s.startMonth
  }

  printPreview(ms, ps, ts, startMonth, dhakaDateString())
  printFlags(flags)

  const blocking = flags.filter((f) => f.severity === "block").length
  if (!has("--commit")) {
    console.log(`\nড্রাই রান — ডাটাবেসে কিছু লেখা হয়নি।${blocking ? ` আগে ${blocking}টি সমস্যার সিদ্ধান্ত নিন।` : ""} ইমপোর্ট করতে: pnpm import:sheet --commit`)
    return
  }
  if (blocking && !has("--force")) {
    console.error(`\n${blocking}টি সমস্যা আছে। শিটে ঠিক করে আবার চালান, অথবা জেনে-বুঝে --force দিন।`)
    process.exitCode = 1
    return
  }
  await commit(ms, ps, ts, startMonth)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => setTimeout(() => process.exit(), 100))
