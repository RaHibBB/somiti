# Samiti Web App — Build Spec (Phase 1)

You are building a web app for a small Bangladeshi cooperative society (samiti). Read this whole file before writing code. Build **Phase 1 only**, step by step, and verify each step before moving on. Ask me only if something here is contradictory; otherwise make a sensible choice and note it in `DECISIONS.md`.

## 1. Context

- Name: **পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি** (Purba Bamon Sundar Somomona Samabay Samiti), Mirsarai, Chattogram. Founded 2026.
- ~32 members today (max ~60). 6 admins ("Admin Panel"), all with **equal** permissions. No president/secretary/treasurer roles.
- Users are non-technical and mostly on **mobile phones** with slow connections. UI language: **Bengali** (Bengali script). Keep English only in code.
- Current records live in a Google Sheet; this app replaces it as the source of truth, and the sheet becomes a **read-only mirror**.

### Business rules (from the samiti's constitution)
- One share = **৳500 per month**. A member holds **1–5 shares**. Monthly due = shares × 500.
- Dues for a month are due between the **1st and 10th**. Due date = 10th of that month. **No late fine.**
- Samiti started **October 2026**; term is at least 3 years (Oct 2026 → Sep 2029, 36 months). Generate months dynamically, not hard-coded to 36.
- New members can join within the first 6 months, but owe **all dues from October 2026** (arrears).
- A member who misses 3 consecutive months gets a notice; admins may cancel membership. Cancelled members stay in the database (status `cancelled`), never deleted.
- Investment: at most **70%** of total fund invested; at least **30%** kept as cash/liquidity.
- Investment process: admins create a proposal → members vote (one member one vote regardless of shares). Valid only if **more than 50% of active members** voted. Yes > No passes; No ≥ Yes (including tie) rejects. *(Phase 2)*
- Year-end profit: **50%** to reserve fund, remaining 50% distributed by share ratio. *(Phase 2)*
- Any member can see all accounts (full transparency). Only admins can write.

## 2. Hard constraints

1. **Zero cost.** Only free tiers: Vercel Hobby, Neon Free, Vercel Blob (Hobby allowance), Google Sheets API via service account, GitHub Actions. No paid APIs, no SMS, no WhatsApp API.
2. **Data is never lost.** No hard deletes anywhere. Mistakes are **voided** with a reason. Every write is recorded in an audit log. Enforce no-delete at the database level too (trigger that raises on DELETE for financial tables).
3. Money stored as **integer taka** (no floats).
4. Timezone **Asia/Dhaka** for all date logic. Display dates as dd/mm/yyyy and numbers in Bengali digits (helper `toBn()`), but store standard values.
5. Mobile-first. Every screen must work well at 360px width. Large tap targets, simple forms.

## 3. Stack

- Next.js (latest, App Router, TypeScript, Server Actions), Tailwind CSS, shadcn/ui.
- Neon Postgres + **Drizzle ORM** (migrations in repo). Use the Neon serverless driver.
- Vercel Blob for receipt images (compress client-side to ≤200 KB, max 1600px, before upload).
- `googleapis` with a **service account** for Sheets sync.
- Auth: custom phone/PIN (see §5). `bcryptjs` for hashing, `jose` for signed session cookie.
- Font: Noto Sans Bengali or Hind Siliguri via `next/font`.
- Brand colours (from the letterhead): primary navy `#1a4059`, dark header `#1d3f57`, accent green from logo, white background.
- Zod for validation on every server action.

## 4. Data model (Drizzle)

- `members`: id, member_no (unique int), name_bn, phone (nullable, unique when set, stored as 11-digit `01XXXXXXXXX`), role (`member` | `admin`), status (`active` | `cancelled`), joined_on (date), nominee_name, nominee_phone, pin_hash, must_change_pin (bool), failed_logins, locked_until, session_version (int), notes, created_at, updated_at.
- `share_history`: id, member_id, shares (1–5, CHECK), effective_month (first day of month), set_by, created_at. A member's shares for a month = latest row with effective_month ≤ that month. (Needed because shares can change and old dues must not change.)
- `settings`: single row — share_price (500), start_month (2026-10-01), due_day (10), term_months (36), reserve_pct (50), max_invest_pct (70).
- `payments`: id, receipt_no (unique, from a Postgres SEQUENCE, displayed `R-0001`), member_id, for_month (date, first of month), amount, paid_on (date), method (`cash` | `bkash` | `nagad` | `rocket` | `bank`), trx_id (nullable), received_by (admin member_id), note, status (`valid` | `void`), void_reason, voided_by, voided_at, created_at.
- `transactions` (non-dues money): id, date, type (`expense` | `investment` | `business_income` | `investment_return` | `bank_profit` | `member_refund` | `dividend`), description, amount (positive int), approved_by, receipt_url (Blob), meeting_date, vote_result (text, optional), status/void fields as payments, created_at.
- `notices`: id, title, body, created_by, created_at, status.
- `audit_log`: id, actor_id, action, table_name, row_id, before (jsonb), after (jsonb), created_at. Insert-only.
- `sheet_outbox`: id, kind, payload (jsonb), status (`pending` | `done` | `failed`), attempts, last_error, created_at.
- Phase 2 tables (create now, no UI yet): `proposals`, `votes` (unique per proposal+member), `profit_distributions`.

## 5. Auth (free, no SMS)

- Login with **phone number OR member number** + **6-digit PIN**.
- Admin sets an initial PIN; `must_change_pin = true` forces the member to set a new PIN on first login.
- Lock account for 15 minutes after 5 failed attempts.
- Session: signed httpOnly cookie (30 days) containing member_id, role, session_version. Bump session_version to log a member out everywhere (on PIN reset or cancel).
- Every server action re-checks the session and role on the server. Members are read-only; only admins can write. Cancelled members cannot log in.
- Admin can reset any member's PIN (logged in audit_log).

## 6. Core calculations (put in `lib/ledger.ts`, unit-tested)

- `monthsDue(today)`: months from start_month whose due date (10th) is **before** today.
- `expectedForMember(member, today)`: Σ over monthsDue of (shares in that month × share_price). Members owe from start_month regardless of join date (arrears rule).
- `paidForMember`: Σ valid payments.
- `dueForMember = max(0, expected − paid)`.
- Per-month status for a member: `paid` (paid ≥ due for that month), `partial`, `unpaid`, `not_yet_due`.
- Fund: total dues + business_income + investment_return + bank_profit − expense − investment − member_refund − dividend. Also show **currently invested** = investment − investment_return, and **cash %** vs the 30% minimum (warn when below).
- Write Vitest tests for these, including: share change mid-term, late joiner arrears, partial payments across two rows, voided rows excluded.

## 7. Pages (Phase 1)

Public:
- `/login`

Member (all logged-in users):
- `/` **Dashboard**: my shares, my total paid, my due (red if > 0), this month's status, samiti total fund, invested vs cash meter, latest notices.
- `/me` **My account**: month-by-month list (paid / partial / unpaid) and every payment with receipt no. Button: **PDF ডাউনলোড**.
- `/members` **All members**: list with paid / due per member, search by name. Tap a member → same view as `/me` for them (read-only).
- `/grid` **Monthly grid**: members × months, coloured cells (green paid, amber partial, red overdue, grey not yet due). Horizontal scroll on mobile with sticky name column.
- `/transactions`: expenses / investments / income list with receipt images.
- `/rules`: the constitution (static Bengali text I will provide in `content/rules.md`).
- `/settings/pin`: change my PIN.

Admin only:
- `/admin/pay` **Take payment** (the most important screen; make it fast):
  1. pick member (searchable list by name or number),
  2. month defaults to the **oldest unpaid month** for that member, amount defaults to that month's remaining due,
  3. method (default cash), optional bKash/Nagad trx ID, optional note,
  4. Save → show big receipt number `R-0012` and a **Share on WhatsApp** button (wa.me link with a prefilled Bengali receipt message to the member's phone).
  Allow "pay multiple months" which creates one payment row per month.
- `/admin/transactions/new`: add expense / investment / income with optional photo.
- `/admin/members`: add member, edit details, change shares (writes share_history), cancel member, reset PIN.
- `/admin/dues`: members with dues > 0, sorted by amount, each with a **WhatsApp reminder** button (wa.me link with prefilled Bengali message incl. amount and months). Free, no API.
- `/admin/void`: void a payment or transaction with a mandatory reason.
- `/admin/audit`: audit log viewer.
- `/admin/export`: download all tables as CSV (Excel-friendly, UTF-8 with BOM so Bengali opens correctly in Excel).

## 8. PDF (free, Bengali-safe)

Do **not** use @react-pdf/renderer or jsPDF — they break Bengali conjuncts. Instead build print pages:
- `/print/member/[id]` (member statement), `/print/month/[yyyy-mm]` (monthly report), `/print/ledger` (full payment ledger), `/print/transactions`.
- A4 print CSS (`@page { size: A4; margin: 12mm }`), letterhead header image (`public/letterhead-header.png`, I will add it), page numbers, generated date.
- "PDF ডাউনলোড" button calls `window.print()`; on mobile Chrome the user chooses "Save as PDF". Show a one-line Bengali hint about this.

## 9. Google Sheet mirror (one-way: app → sheet)

- Env: `GOOGLE_SERVICE_ACCOUNT_JSON` (base64), `SHEET_ID`.
- On every write, insert a row in `sheet_outbox` in the same DB transaction, then use Next.js `after()` to push pending rows to the sheet (append rows). Never block the user on Sheets.
- Tabs in the mirror sheet: `Members`, `Payments`, `Transactions`, `Monthly Summary`. Voided rows stay, marked `বাতিল`.
- `/api/cron/sheet-sync` (Vercel Cron, **once a day** — Hobby allows daily cron): retry pending/failed outbox rows; on Sundays also **rewrite every tab fully** from the database to fix any drift. Protect the route with `CRON_SECRET`.
- The sheet is view-only for humans; only the service account edits it. Put a note in row 1 of each tab: "এই শিট শুধু দেখার জন্য। হিসাব লিখুন ওয়েবসাইটে।"

## 10. Weekly backup (free)

- GitHub Actions workflow `.github/workflows/backup.yml`, weekly (Friday 02:00 Asia/Dhaka) + manual trigger.
- Run `pg_dump` (Postgres client matching Neon's major version) using secret `DATABASE_URL`, gzip it, and **commit** it to a separate **private** repo (`samiti-backups`) under `backups/YYYY-MM-DD.sql.gz` using a fine-grained token secret. Also export CSVs of each table alongside.
- Document how to restore in `README.md`.

## 11. One-time import from the current Google Sheet

Script `scripts/import-from-sheet.ts` (run locally) that reads the existing sheet (ID `1dNE_p2ppkKP7ZZ9O_yw2xJA57FQ5A-aKsbFk-t_HF9g`, tabs `সদস্য তালিকা`, `জমা খাতা`, `আয়-ব্যয় ও বিনিয়োগ`) and imports members, share counts, payments and expenses.
- Dry-run mode first that prints a report.
- **Flag, do not auto-fix**: members with more than 5 shares (e.g. one member has ৳5,000/month = 10 shares), payments missing a date, missing phone numbers. Print them for admins to decide.
- Seed these 6 as admins (match by phone): 01859336893, 01310760069, 01834248280, 01723332916, 01980640702, 01892785486. Everyone else `member`. Generate random initial PINs and print them once so admins can hand them out.

## 12. Build order

1. Scaffold, Tailwind/shadcn, Bengali font, layout with bottom nav for mobile.
2. Drizzle schema + migrations + no-delete triggers + seed settings.
3. Auth (login, PIN change, lockout, roles, middleware).
4. `lib/ledger.ts` + tests.
5. Admin: members, take payment, transactions, void, audit.
6. Member pages: dashboard, me, members, grid, transactions, rules.
7. Print/PDF pages.
8. Sheet outbox + cron sync.
9. CSV export + GitHub backup workflow.
10. Import script.
11. README (setup, env vars, deploy to Vercel, restore from backup).

## 13. Env vars

`DATABASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`, `CRON_SECRET`. Provide `.env.example`.

## 14. Done when

- An admin on a phone can record a payment in under 20 seconds.
- A member can log in and see exactly what they've paid and owe, matching the sheet.
- Voiding works and voided amounts disappear from totals but stay visible as "বাতিল".
- No code path issues a DELETE on financial tables, and the DB rejects one if attempted.
- Printed statement shows correct Bengali conjuncts (test with "ক্ষ", "ন্ত", "স্ব").
- Sheet mirror updates within a minute of a write, and the Sunday full rewrite matches the DB.
- Ledger tests pass; `pnpm build` passes with no type errors.

## Phase 2 (do NOT build yet)
Online voting on proposals (rules in §1), year-end profit distribution calculator, notices editor, investment 70/30 enforcement warnings on new investments.
