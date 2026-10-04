# Samiti web app

Accounts for **পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি** (Mirsarai, Chattogram): member dues, receipts, expenses/investments, a read-only Google Sheet mirror and weekly backups. Mobile-first, Bengali UI, runs entirely on free tiers.

- Spec: [`SAMITI_SPEC.md`](SAMITI_SPEC.md) · Judgment calls: [`DECISIONS.md`](DECISIONS.md)
- Stack: Next.js 16 (App Router, Server Actions) · Tailwind 4 + shadcn/ui · Neon Postgres + Drizzle · Vercel Blob · Google Sheets API · GitHub Actions

---

## 1. Local development

Requirements: Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env
```

You don't need Neon to try the app locally. Set these in `.env`:

```
DATABASE_URL="pglite:./.pglite"
SESSION_SECRET="<any 32+ random characters>"
```

`pglite:` runs an embedded Postgres in the `.pglite` folder (gitignored). Then:

```bash
pnpm db:migrate     # create tables, triggers, settings row
pnpm db:seed-dev    # demo members/payments (demo logins + dev password are in scripts/seed-dev.ts)
pnpm dev            # http://localhost:3000
```

Stop `pnpm dev` before running any script against the same `.pglite` folder (PGlite allows one process at a time).

Checks:

```bash
pnpm typecheck      # next typegen + tsc
pnpm test           # Vitest: ledger, auth, DB guards, services, sheet sync, CSV, import parser
pnpm build
```

## 2. Environment variables

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon → Connection details. The pooled string is fine for the app. |
| `SESSION_SECRET` | 32+ random chars: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Changing it logs everyone out. |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when you connect a Vercel Blob store to the project. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key JSON, **base64-encoded** (see §4). |
| `SHEET_ID` | ID of the mirror spreadsheet (the long part of its URL). |
| `CRON_SECRET` | Any random string. Vercel sends it to the cron route automatically. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | For password-reset emails (§4a). Free with a Gmail App Password. |
| `APP_URL` | Optional. Site address used in reset links; on Vercel the production domain is used automatically. |

See [`.env.example`](.env.example).

## 3. Deploy to Vercel (Hobby, free)

1. **Neon:** create a free project (region: Singapore `ap-southeast-1` is closest to Bangladesh). Copy the connection string.
2. **Migrate** from your computer:
   ```bash
   DATABASE_URL="postgresql://…neon.tech/…?sslmode=require" pnpm db:migrate
   ```
3. **Vercel:** push this repo to GitHub → *Add New Project* → import it. Framework is detected automatically.
4. **Storage → Blob → Create** and connect it to the project (adds `BLOB_READ_WRITE_TOKEN`).
5. **Settings → Environment Variables:** add `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`, `CRON_SECRET`. Redeploy.
6. **Cron:** `vercel.json` already schedules `/api/cron/sheet-sync` daily at 21:00 UTC (03:00 Dhaka). Hobby allows one run per day. Sunday runs rewrite the whole sheet.
7. **Import the members** (§6), or create the first admin by hand.

> First admin without the import: insert one row with SQL in the Neon console, then use *সদস্য ব্যবস্থাপনা* in the app for everyone else.
> ```sql
> -- PIN hash for a temporary PIN: node -e "require('bcryptjs').hash('482915',10).then(console.log)"
> INSERT INTO members (member_no, name_bn, phone, role, joined_on, pin_hash, must_change_pin)
> VALUES (1, 'নাম', '01XXXXXXXXX', 'admin', '2026-10-01', '<hash>', true);
> INSERT INTO share_history (member_id, shares, effective_month) VALUES (1, 1, '2026-10-01');
> ```

## 4a. Login and password reset

- Members log in with **email, mobile number or member number** plus a **password** (6–64 characters, anything). Old 6-digit PINs keep working as passwords.
- New members get a temporary password from an admin and must choose their own at first login. Members can add their email under *আরও → পাসওয়ার্ড ও ইমেইল*.
- **পাসওয়ার্ড ভুলে গেছেন?** emails a one-time link (valid 30 minutes, max 3 per hour). Members without an email ask an admin, who creates a temporary password on the member's page.
- **Free email setup (Gmail):** use a Gmail account for the samiti → turn on 2-Step Verification → create an [App Password](https://myaccount.google.com/apppasswords) → set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<that gmail>`, `SMTP_PASS=<app password>`. Gmail allows ~500 emails/day, far more than needed.
- In local development without SMTP settings, reset emails are printed in the `pnpm dev` console.

## 4. Google Sheet mirror (one-way, app → sheet)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project → enable **Google Sheets API**.
2. *IAM & Admin → Service Accounts → Create*. No roles needed. Open it → *Keys → Add key → JSON*.
3. Base64-encode the file and put it in `GOOGLE_SERVICE_ACCOUNT_JSON`:
   - macOS/Linux: `base64 -w0 key.json` (macOS: `base64 -i key.json`)
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`
4. Open the mirror spreadsheet → **Share** → add the service account's email (`…@….iam.gserviceaccount.com`) as **Editor**.
5. Make it view-only for people: share with members as **Viewer** only (and *Protect sheet* if you like). The app writes row 1 of each tab: "এই শিট শুধু দেখার জন্য। হিসাব লিখুন ওয়েবসাইটে।"
6. Click **"Google Sheet এখনই পুরো আপডেট করুন"** on `/admin/export` once. It creates the tabs `Members`, `Payments`, `Transactions` and `Monthly Summary` and fills them.

How it stays in sync: every write adds a `sheet_outbox` row in the same DB transaction; right after the response the app pushes pending rows. The daily cron retries anything that failed, and Sundays rewrite every tab to remove drift. Voided rows stay in the sheet, marked `বাতিল`.

## 5. Weekly backup (GitHub Actions)

`.github/workflows/backup.yml` runs **every Friday 02:00 Asia/Dhaka** (and on demand). It saves:

- `backups/YYYY-MM-DD.sql.gz`: full `pg_dump` (schema, data, triggers, sequences)
- `backups/csv/YYYY-MM-DD/<table>.csv`: one Excel-friendly CSV per table (members without PIN hashes)

Setup:

1. Create a **private** repo named `samiti-backups` (same owner as this repo). Add a README so it has a default branch.
2. Create a **fine-grained personal access token**: *Repository access → only `samiti-backups`*, *Permissions → Contents: Read and write*.
3. In **this** repo → *Settings → Secrets and variables → Actions*:
   - `DATABASE_URL`: Neon connection string. Use the **direct** host (without `-pooler`), which is what pg_dump needs.
   - `BACKUP_REPO_TOKEN`: the token above.
   - (optional variable `BACKUP_REPO` = `owner/name` if the backup repo is elsewhere.)
4. *Actions → Weekly backup → Run workflow* once to test.

`PG_MAJOR` in the workflow must be ≥ Neon's Postgres version (Neon shows it in the project dashboard; default 17).

### Restore from a backup

Restore into a **new, empty** database (a new Neon project or branch), never on top of live data:

```bash
# 1. Get the file
git clone https://github.com/<owner>/samiti-backups && cd samiti-backups

# 2. Restore (psql must be the same or newer major version)
gunzip -c backups/2026-10-30.sql.gz | psql "postgresql://…/neondb?sslmode=require" -v ON_ERROR_STOP=1

# 3. Check
psql "$NEW_URL" -c "select count(*) from members; select count(*), sum(amount) from payments where status='valid';"
```

Then point `DATABASE_URL` in Vercel at the new database and redeploy. The dump includes the receipt-number sequence and the no-delete triggers, so receipt numbers continue correctly.

## 6. One-time import from the current sheet

Reads the existing sheet (tabs `সদস্য তালিকা`, `জমা খাতা`, `আয়-ব্যয় ও বিনিয়োগ`) and loads members, shares, payments and expenses.

```bash
# 1. Dry run: reads the sheet, prints balances + problems, writes nothing
pnpm import:sheet

# 2. Fix the flagged problems in the sheet (or decide them in a meeting), run the dry run again

# 3. Import (DATABASE_URL must point at the new, migrated, EMPTY database)
pnpm import:sheet --commit
```

- **Flagged, never auto-fixed:** members with more than 5 shares, payments with a missing/unreadable date, unknown member numbers, ambiguous payment methods, phone numbers shared by two members, members without a phone.
- `--commit` refuses while blocking problems remain. `--force` imports anyway: flagged payments are skipped, and members with >5 shares get **no shares** until an admin sets them.
- Admins are matched by phone: 01859336893, 01310760069, 01834248280, 01723332916, 01980640702, 01892785486.
- Every member gets a random 6-digit PIN, **printed once** at the end. Hand them out privately and clear the terminal. Everyone must change their PIN at first login.
- Reading uses the sheet's public CSV export while it's link-shared. If you turn link sharing off, use `--source=api` (service account with read access) or `--from-dir=<folder>` with `members.csv`, `payments.csv`, `transactions.csv`.

After importing, press **"Google Sheet এখনই পুরো আপডেট করুন"** on `/admin/export`.

## 7. How the money rules are implemented

- Monthly due = shares × ৳500, due between the 1st and 10th; a month counts as owed from the 11th (Asia/Dhaka).
- Everyone owes from October 2026 regardless of join date (arrears). Share changes apply from a chosen month and never change past months.
- Fund (cash on hand) = dues + business income + investment returns + bank profit − expenses − investments − refunds − dividends. Invested = investments − returns. The dashboard warns when cash falls below 30% of the total.
- Calculations: `lib/ledger.ts` (unit-tested).

## 7a. Phase 2: voting, profit, notices

- **প্রস্তাব ও ভোট** (`/proposals`): admins publish a proposal; members vote yes/no once. Valid only if more than half of active members vote; Yes must beat No. Votes close at the end of the chosen day (or earlier by an admin) and are closed automatically.
- **৭০/৩০:** new investments and proposals show how much cash will remain and warn below 30%; saving below the minimum needs an explicit checkbox.
- **বার্ষিক মুনাফা বণ্টন** (`/profit`): profit for a samiti year (Oct–Sep), 50% to reserve, the rest split by share-months among active members. Admins can save it (optionally recording the dividend payout); everyone can see the result.
- **নোটিশ** (`/admin/notices`, `/notices`): write and archive notices.

## 8. Data safety

- **No deletes:** Postgres triggers reject `DELETE` and `TRUNCATE` on every table. Votes are accepted only on open proposals from active members, and decided proposals can't change (`drizzle/0006_phase2_guards.sql`). Payments and transactions can only change once, from valid to **void** (with a reason). `audit_log` and `share_history` are insert-only. See `drizzle/0001_guards_and_seed.sql` and `tests/db-guards.test.ts`.
- Every write records an `audit_log` row (viewable at `/admin/audit`).
- Money is stored as whole taka (integers).

## 9. Project layout

```
app/(app)/          logged-in pages (dashboard, me, members, grid, transactions, rules, admin/*)
app/print/          A4 print pages ("PDF ডাউনলোড" → browser Save as PDF)
app/login/          login
app/api/cron/       daily sheet sync
lib/ledger.ts       money calculations
lib/services/       all writes (each = data + audit + outbox in one transaction)
lib/sheets/         Google Sheet mirror
lib/import/         sheet import parser
lib/db/schema.ts    Drizzle schema; migrations in drizzle/
content/rules.md    constitution text (replace the placeholder)
public/letterhead-header.png   letterhead for printouts (add it; a text header is used until then)
```

## 10. Still to provide

- `content/rules.md`: the constitution text (a short placeholder is there now).
- `public/letterhead-header.png`: the letterhead image for printouts.
- The real logo green: replace `--brand-green` in `app/globals.css` (currently a placeholder `#2e8b3e`).
