# Decisions

Judgment calls made while building Phase 1 from `SAMITI_SPEC.md`. Newest steps at the bottom.

## Step 1 — Scaffold

- **Next.js 16.3** (latest). In v16 "middleware" is renamed **proxy** (`proxy.ts`); the spec says "middleware", so the route guard lives in `proxy.ts`.
- **shadcn/ui** initialised with its current default (`base-nova` style on Base UI). The CLI added an npm package called `cn`; I replaced it with the usual local `lib/utils.ts` (`clsx` + `tailwind-merge`) so the helper is plain code in the repo. Also removed `next-themes`: the app is light-only, which matches the white letterhead.
- **Font:** Noto Sans Bengali (a variable font, good conjunct coverage) via `next/font/google`, exposed as `--font-bengali`.
- **Accent green:** I don't have the logo, so I picked `#2e8b3e` as a placeholder. Change `--brand-green` in `app/globals.css` once the real logo colour is known.
- **Bottom nav (5 tabs):** হোম · আমার হিসাব · সদস্য · গ্রিড · আরও. For admins, slot 2 becomes **জমা নিন** (`/admin/pay`) because that's the screen they use most; admins reach their own account from the আরও menu. I added a `/more` page (not in the spec) that links to the less-used pages: transactions, rules, PIN change, admin tools and logout.
- **Payment method labels:** `cash` = "ক্যাশ" and `nagad` = "নগদ", so the two are never confused (in Bengali "নগদ" can also mean cash).
- Numbers use Bangladeshi digit grouping (১২,৩৪,৫৬৭).
- Added scripts: `pnpm typecheck` (runs `next typegen` then `tsc`), `pnpm test` (Vitest).

## Step 2 — Schema & migrations

- **Driver:** `drizzle-orm/neon-serverless` (WebSocket `Pool`), not `neon-http`. Writes need real interactive transactions (payment + audit row + outbox row commit together), and neon-http doesn't support those.
- **Dates** are stored as Postgres `date` and handled in code as `"YYYY-MM-DD"` strings. Month keys are always the 1st of the month (CHECK constraint). This avoids timezone bugs entirely.
- **Database guards** (migration `0001_guards_and_seed.sql`), covered by `tests/db-guards.test.ts` on PGlite:
  - DELETE and TRUNCATE are rejected on **every** table, not only the financial ones, because the spec says "no hard deletes anywhere".
  - `payments`, `transactions`, `profit_distributions`: the only allowed UPDATE is `valid → void`, with a reason, changing only the void columns. A void row can never be changed again. To fix a typo, void the row and enter a new one.
  - `audit_log`, `share_history`, `votes` are insert-only (UPDATE rejected).
- **Settings seed** lives in the migration (`INSERT … ON CONFLICT DO NOTHING`), so every fresh database starts with the constitution defaults.
- **Extra columns not in the spec:** `members.cancelled_at` / `cancel_reason`; `transactions.created_by` (the admin who entered it). `approved_by` stays free text (e.g. "সভার সিদ্ধান্ত") because approval comes from a meeting, not one admin. `sheet_outbox.processed_at`.
- `members.pin_hash` is nullable. A member with no PIN simply cannot log in until an admin sets one.
- `share_history.set_by` and `payments.received_by` are nullable so rows from the one-time sheet import (which have no app actor) can be stored.
- Phone CHECK: `^01[3-9][0-9]{8}$` (Bangladeshi mobile).
- Phase 2 tables created with a reasonable shape: `proposals` (with `active_members_at_close` for the >50% quorum rule), `votes` (unique per proposal + member), `profit_distributions`. No UI.

## Step 3 — Auth

- **Login identifier:** a valid BD mobile number (also accepts `+880…`, `880…`, Bengali digits and dashes) is treated as a phone; 1–4 digits are treated as a member number.
- **Generic error** ("নম্বর অথবা পিন ভুল") for unknown numbers and wrong PINs. Unknown numbers still run a dummy bcrypt compare, so response timing doesn't reveal which numbers exist. The lockout and cancelled messages are specific, because a member needs to know what to do next.
- **Lockout:** on the 5th consecutive failure, `locked_until = now + 15 min` and the counter resets. A successful login resets the counter. Lockouts are written to `audit_log` (`login_locked`); routine failed attempts are not, to keep the log readable.
- **Weak PINs rejected** when a member sets their own PIN: all-same digits (111111) and straight sequences (123456, 654321). Generated PINs never fall in this set.
- **Changing your own PIN** bumps `session_version` (logs out every other device) and re-issues the cookie for the current device.
- **Role is read from the database** on every request (`requireAdmin`). The role in the cookie is used only by `proxy.ts` for the optimistic `/admin` redirect.
- `(app)/layout.tsx` hides the bottom nav while a PIN change is pending. Every page calls `requireMember()` / `requireAdmin()` itself; layouts aren't treated as a security boundary.
- **Local dev without Neon:** `DATABASE_URL="pglite:./.pglite"` uses embedded Postgres (PGlite). `pnpm db:migrate` then `pnpm db:seed-dev` creates demo data; the dev PIN is in `scripts/seed-dev.ts`. Production code paths always use Neon.
- Shadcn primitives were made larger by default: inputs 48px, buttons 44px, a new `xl` (56px) size for primary actions, and a native `<select>` (the phone's own picker) instead of the custom Select.

## Step 4 — Ledger (`lib/ledger.ts`)

- **Pure functions.** Nothing reads the clock or the DB; callers pass `today` (Asia/Dhaka) and the rows. This keeps them easy to test.
- **"Due" means strictly after the 10th.** On the 10th itself the month is still within the payment window, so it isn't due yet. From the 11th it counts toward the member's due. This follows "due date (10th) is before today".
- **Late joiners:** if a member's share history starts after `start_month` (e.g. it's recorded from their join month), their **earliest** share count is used for the earlier months. That way arrears from October 2026 are always charged.
- **Same-month share changes:** the latest row (highest id) wins.
- **Month status:** `paid` = paid ≥ expected (advance payments for future months count as paid). For a future month, a partial payment shows `partial` and nothing paid shows `not_yet_due`. For a due month: `partial` or `unpaid`.
- **Take-payment default month** = oldest month with anything remaining, including the current not-yet-due month. A member who is fully up to date is offered this month.
- **Fund:** the spec's formula gives **cash on hand** (`cash`). `invested = investment − investment_return` (never below 0), `total = cash + invested`, `cash% = cash / total`, with a warning below `100 − max_invest_pct` (30%). This treats `investment_return` as principal coming back; profit earned on an investment should be entered as `business_income`.
- **3-month notice rule:** `trailingMissedMonths()` counts consecutive not-fully-paid due months ending at the latest due month. `/admin/dues` flags 3 or more.
- `allMonths()` covers start → end of term (from `term_months`), extended to the current month if the samiti runs past its term.

## Step 5 — Admin screens

- **Architecture:** writes live in `lib/services/*` (plain functions that take a `db`; tested against PGlite in `tests/services.test.ts`). Server actions are thin wrappers built on `adminAction()` (`lib/actions.ts`). That wrapper re-checks the session and admin role on the server, turns errors into Bengali messages, and after a successful write schedules the sheet sync with `after()`. Zod validates every action input. Bengali digits and commas are accepted in numbers.
- **Every write** = data row + `audit_log` row + `sheet_outbox` row, in one DB transaction.
- **Take payment:**
  - Month chips list every month with something remaining, oldest first, so the oldest unpaid month is pre-selected and the amount pre-filled.
  - Tapping more chips switches to "pay multiple months": each selected month is charged its full remaining amount, with one payment row (and receipt) per month.
  - Method buttons default to ক্যাশ; the trx ID field appears only for non-cash. Date and note are tucked away (date defaults to today, Asia/Dhaka).
  - **Idempotency:** the form sends a random `client_ref`, and a retry or double tap returns the original receipts instead of duplicating. This needed a new column, `payments.client_ref` (migration `0002`), unique per (client_ref, for_month).
  - WhatsApp: `wa.me/880…` with a Bengali receipt (months, amounts, receipt numbers, remaining due). If there's no phone, `wa.me/?text=` lets the admin pick the contact.
- **Members:**
  - Adding a member creates the first `share_history` row, defaulting to `start_month` (arrears rule).
  - The initial PIN is auto-generated unless the admin types one, and it's shown **once**.
  - Changing shares inserts a new history row (default: next month).
  - Changing role, resetting a PIN or cancelling bumps `session_version` (logs the member out everywhere).
  - Guards: an admin can't cancel themselves, and the last active admin can't be demoted or cancelled.
- **Receipt photos:** compressed in the browser (≤1600px, ≤200 KB JPEG, transparency becomes white) and sent with the server action. They're stored in Vercel Blob as `public` with a random suffix, because members can see every account anyway. Without a Blob token in development they're saved to `public/dev-uploads/` (gitignored).
- **Void:** search by receipt number (`R-0012`, `12`, `১২`) or member name/description. A reason of at least 3 characters is required. Voided rows stay listed with the reason.
- **`/admin/dues`** was built in this step too: sorted by amount, a WhatsApp reminder (amount + month names), a "জমা নিন" shortcut, and a warning on members with 3+ consecutive missed months (constitution notice rule).
- Members on the forced-PIN screen get a logout link, since the bottom nav is hidden there.

## Step 6 — Member pages

- **Data loading:** `getSnapshot()` loads all members, share history and payments in 3 queries (with React `cache`, so once per request) and computes every balance with `lib/ledger.ts`. At ≤60 members × 36 months this is tiny, and it guarantees every page shows the same numbers.
- **Dashboard:** my due is a big card (red when > 0); then shares, total paid, this month's status, the samiti fund (cash + invested), a two-colour meter (green cash / navy invested) with a warning below the 30% minimum, and the 3 latest active notices.
- **`/me` and `/members/[id]`** share one component (`MemberStatement`). The month list shows every due month plus the next 3 upcoming ones (not all 36), to keep it short on a phone. Voided payments stay listed, struck through and labelled "বাতিল — reason".
- **Grid:** status symbols (✓ ◐ ✗) are added to the colours, so the grid is readable for colour-blind members and in grey-scale printouts. The name column is sticky, the grid auto-scrolls to the current month, and tapping a cell shows month/paid/expected (title tooltip). Cancelled members with no payments are hidden from the grid.
- **Rules:** `content/rules.md` currently holds a **placeholder** summarising the spec's business rules. Replace it with the real constitution text. It's rendered by a tiny built-in Markdown renderer (headings, lists, bold) with no raw-HTML passthrough, and included in the Vercel bundle via `outputFileTracingIncludes`.
- Short month names are spelled out (অক্টো, নভে…) rather than sliced, because slicing Bengali strings can break a conjunct.

## Step 7 — Print / PDF

- Print pages live outside the `(app)` group (no header or bottom nav) and need any logged-in member, since accounts are transparent to all.
- **Page numbers:** CSS page-margin boxes (`@page { @bottom-right { content: counter(page) " / " counter(pages) } }`), supported by Chrome/Edge 131+, which includes current Android Chrome. Older browsers print without page numbers; nothing else breaks.
- **Generated date** appears at the top of every document (Asia/Dhaka, Bengali digits). Table headers repeat on every page and rows don't split across pages.
- **Letterhead:** `public/letterhead-header.png` isn't in the repo yet, so a text header (name, Mirsarai, founded 2026, navy rule) is shown automatically until the image is added. No code change is needed after you add it.
- **Conjuncts:** print uses the same embedded Noto Sans Bengali web font as the app. In the browser, `document.fonts.check()` confirms it covers ক্ষ, ন্ত, স্ব, and demo names "সুমাইয়া ক্ষমা" and "স্বপ্না দাস" render correctly. The final check is a real "Save as PDF" on a phone; I can't do that from here.
- **`/print/month/[yyyy-mm]`** has three parts: (1) each member's dues for that month and their status, (2) every payment *received* in that calendar month by payment date, whatever month it was for, and (3) that month's transactions. It has prev/next links (screen only). `/print/month` redirects to the current month. The আরও menu links to the monthly report and the full ledger.
- Voided rows are printed struck through with "বাতিল — reason" and are excluded from totals.

## Step 8 — Google Sheet mirror

- **Upsert by id, not pure append.** Column A of every tab is the database id. New rows are appended, and rows that already exist are updated in place. Voiding therefore flips the original row to "বাতিল" (with the reason) instead of adding a second, contradictory row. This is the only way "voided rows stay, marked বাতিল" holds with an incremental sync.
- **Outbox payload is just `{ id }`.** The sync reads the row's *current* state when it pushes, so it's always up to date even if a void lands before the first push. A payment also refreshes the payer's row in `Members` (their totals changed). `Monthly Summary` is small (one row per month), so it's rebuilt on every flush.
- **Concurrency:** each flush round runs in a DB transaction holding `pg_try_advisory_xact_lock`. If two writes finish at once, the second flush skips instead of double-appending. A flush loops up to 5 batches of 300.
- **Failures:** the whole batch is marked `failed` with `last_error` and `attempts + 1`. The `after()` flush only takes `pending` rows, so a broken Sheets API doesn't slow every save. The daily cron retries `pending` and `failed`.
- **Cron:** `vercel.json` runs `/api/cron/sheet-sync` daily at 21:00 UTC (03:00 Asia/Dhaka). The full rewrite runs when that call happens on a **Sunday in Dhaka**, or when called with `?full=1`. The route requires `Authorization: Bearer $CRON_SECRET` (compared in constant time).
- Tabs are created automatically if missing, with row 1 = "এই শিট শুধু দেখার জন্য। হিসাব লিখুন ওয়েবসাইটে।", row 2 = Bengali headers, and the top two rows frozen. Making the sheet view-only for humans is a sharing setting in Google Sheets (see README).
- `googleapis` is imported lazily, only when a sync actually runs, to keep cold starts fast. Without `GOOGLE_SERVICE_ACCOUNT_JSON`/`SHEET_ID` the sync is a no-op and the outbox simply accumulates; the first Sunday rewrite or `?full=1` catches up.
- Tested against an in-memory fake sheet (`tests/sheet-sync.test.ts`): push, in-place void, failure/retry, and a full rewrite that removes drift.

## Step 9 — CSV export & backups

- **CSV:** `/admin/export/<table>` (admin only) streams one table as CSV: UTF-8 **with BOM** (checked: bytes `EF BB BF`), CRLF, RFC 4180 quoting. Text cells starting with `= + - @` get a leading `'` so Excel won't run them as formulas (numbers are untouched). Columns use the code's field names (camelCase), so they match the schema exactly. **PIN hashes are never exported.** Tables: members, share_history, payments, transactions, notices, settings, audit_log, sheet_outbox. There's one link per table rather than a zip, to avoid adding a dependency.
- The export page also shows the sheet outbox status (pending/failed) and has a "rewrite the Google Sheet now" button. It's the same full rewrite the Sunday cron does, for when admins don't want to wait.
- **Backup workflow** (`.github/workflows/backup.yml`):
  - Runs Thursday 20:00 UTC (= **Friday 02:00 Asia/Dhaka**), plus manual runs.
  - Installs `postgresql-client-17` from the official PGDG apt repo. `PG_MAJOR` is one env line to change if Neon's server version differs; `pg_dump` must be ≥ the server version.
  - `pg_dump --no-owner --no-privileges | gzip -9` → `backups/YYYY-MM-DD.sql.gz` (date in Dhaka), plus `gzip -t` to verify the archive.
  - CSVs (with BOM) go to `backups/csv/YYYY-MM-DD/<table>.csv`. The members CSV leaves out `pin_hash`; the SQL dump keeps everything so a restore is complete.
  - Pushes to `<owner>/samiti-backups` (override with the repo variable `BACKUP_REPO`) using the `BACKUP_REPO_TOKEN` fine-grained token. It commits only if something changed.
  - Recommend the Neon **direct** (non-pooled) connection string for `DATABASE_URL` here, since pg_dump works best without PgBouncer.
- I couldn't run the workflow here (no GitHub repo or Neon yet); the YAML parses. Do a first manual "Run workflow" after setup (README).

## Step 10 — Import from the old sheet

- **Source:** the sheet is currently link-readable, so by default the script reads each tab through Google's public CSV export (no credentials). `--source=api` uses the service account instead, and `--from-dir` reads exported CSV files. Parsing is a pure module (`lib/import/parse.ts`), tested with **synthetic** data only, so no real member data is in the repo.
- **Dry run by default.** `--commit` writes, but **refuses while any blocking flag remains**. `--force` imports anyway: flagged payments are skipped, and flagged members are imported **without a share_history row** (owing ৳0 until an admin sets their shares). That is "flag, don't auto-fix". The import is one-time: it refuses if `members` isn't empty.
- **What the dry run against the real sheet found (2026-10-04):** 32 members (all 6 admin phones matched), 17 October payments totalling ৳১৫,০০০, no transactions yet, and:
  - **Member ২২ has 10 shares (৳৫,০০০/month)** → blocking, admins decide.
  - **Three phone numbers are shared by two members each** (rows for members ২৩, ২৪, ২৬) → blocking, because a phone must be unique to log in with it. With `--force`, the second member of each pair is imported without a phone and logs in with their member number.
  - 12 members have no phone (warning; they log in with their member number).
  - The totals row at the bottom is skipped.
- **Column mapping:**
  - `জমার তারিখ` dd/mm/yyyy → `paid_on`; `কোন মাসের চাঁদা` "অক্টোবর ২০২৬" → `for_month`.
  - `মাধ্যম`: "নগদ টাকা" → cash, "বিকাশ" → bkash. A bare "নগদ" is flagged as ambiguous (cash or the Nagad wallet?).
  - The old `রসিদ নং` column actually holds bKash transaction IDs, so it becomes `trx_id` for mobile payments (or a "পুরনো রসিদ নং" note for cash).
  - New receipt numbers R-0001… are issued in payment-date order.
  - `কে টাকা নিলেন` holds English first names that can't be matched reliably to Bengali member names, so it's kept in the note ("গ্রহণকারী: …") and `received_by` stays empty rather than guessed. "Received" comments are dropped.
  - `জরিমানা` is ignored (no fines in the constitution); a warning is shown if it's filled.
  - Empty joining dates default to the start month.
- **PINs** are random 6-digit, non-weak, `must_change_pin = true`, and printed once at the end of a commit. One `audit_log` row records the import.
- Verified end-to-end on a throwaway PGlite database (then deleted).

## Step 11 — README & final checks

- README is in English (it's for whoever sets up and maintains the app); the app itself is entirely Bengali.
- Restore instructions always restore into a **new, empty** database and then repoint `DATABASE_URL`, never on top of live data.
- Final state: `pnpm lint` clean, `pnpm typecheck` clean, 68/68 tests, `pnpm build` passes. The only `.delete(` in the codebase clears the session cookie; the database rejects DELETE/TRUNCATE on every table.
- Not built (Phase 2, per spec): voting UI, profit distribution calculator, notices editor, 70/30 enforcement on new investments. Their tables exist.

## After Phase 1 — Email + password login (requested 2026-10-04)

- **Why a login failed:** the identifier field only allowed 20 characters (phone/member number), so typing an email produced the generic "দিন" error. It now accepts up to 254 characters.
- **Email *added*, not a replacement.** The identifier can be an **email, a mobile number or a member number**. The import found that most members have no email and 12 have no phone, so removing the other options would lock people out.
- **PIN → password:** any 6–64 characters (bcrypt limit), with weak ones rejected (one repeated character, digit runs like 123456, a short list of common passwords). Existing 6-digit PINs remain valid passwords. Admin-generated temporary passwords stay 6 digits so they're easy to read out. The DB columns keep their names (`pin_hash`, `must_change_pin`) to avoid a risky rename; only the UI says "পাসওয়ার্ড". The route `/settings/pin` is kept (spec §7) and now also lets members set their own email.
- **Eye icon** (`components/forms/password-input.tsx`) on every password field: login, change, reset.
- **Forgot password:**
  - Email link only. SMS stays out (cost), and WhatsApp needs a paid API.
  - The token is 32 random bytes; only its SHA-256 is stored (`password_resets`, migration `0003`). It expires in 30 minutes, is single use, and is limited to 3 per member per hour.
  - Using it bumps `session_version` (logs out everywhere) and signs the member in.
  - The page always says "if an account exists, a link was sent", so it can't reveal which emails are registered.
  - Members without email are told to ask an admin. `password_resets` rows are never deleted (migration `0004`), like every other table.
- **Email delivery** uses plain SMTP via `nodemailer`. Gmail with an App Password is free (≈500/day), which keeps the zero-cost rule. In development without SMTP settings the email is printed to the server console.
- **Reset links** use `APP_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, and only in local dev the request's Host header. This prevents a forged Host header from producing phishing links.
- Emails are stored lower-case (CHECK constraint) and are unique.

## Phase 2 (requested 2026-10-04, after Phase 1)

**Voting** (`lib/voting.ts`, `lib/services/proposals.ts`, `/proposals`, `/admin/proposals/new`)
- Rules from §1, unit-tested: valid only if **more than 50%** of active members voted (`2 × voted > active`, so 16 of 32 is not enough and 17 is). Then Yes > No passes; No ≥ Yes, including a tie, rejects. "Active members" is measured **when the vote closes** and stored on the proposal (`active_members_at_close`), so the result never changes later.
- An admin publishes a proposal (title, details, optional amount, last voting day). Voting ends at 23:59 Dhaka on that day; an admin can also close it early. Expired proposals are closed automatically when someone opens the dashboard or proposal pages, and by the daily cron.
- One vote per member; **votes can't be changed** (insert-only, as before). Admins vote like everyone else.
- **While voting is open, only turnout is shown** (e.g. ১২/৩২, ১৭ needed), not yes/no counts, so early results don't sway later voters. After closing: yes / no / didn't vote, the quorum, and a plain-language outcome.
- **Ballots are secret in the UI:** anyone can see *who* has voted (helps chase turnout), never which way. The choice is stored in `votes`. The audit log records that a vote was cast but not the choice.
- **Database guards** (migration `0006`): votes are accepted only for an open proposal before its deadline and only from active members. An open proposal's text and amount can't be edited, only closed. A decided proposal (passed / rejected / invalid) can never change. No deletes, as everywhere.
- The dashboard shows a blue "আপনার ভোট দরকার" card for each open proposal you haven't voted on.

**70/30 warnings**
- New proposals and new `investment` transactions show live "cash after this investment: ৳X (Y%)" and warn below 30% (or when the amount exceeds cash).
- The server re-checks. Going below the minimum needs an explicit "জেনে-বুঝে" checkbox: a warning that must be acknowledged, as Phase 2 asks, not a hard block.
- An investment can be linked to a **passed** proposal (`transactions.proposal_id`, migration `0005`). The vote result ("হ্যাঁ X, না Y (প্রস্তাব #N)") is filled in automatically, and the proposal page lists its transactions. A link to a proposal that didn't pass is rejected.

**Year-end profit** (`lib/profit.ts`, `lib/services/profit.ts`, `/profit`)
- Year = samiti year from `start_month` (Oct 2026 – Sep 2027, …).
- Profit = business income + bank profit − expenses dated in that year. `investment_return` is treated as principal coming back (same as the fund calculation), not profit.
- Reserve = `reserve_pct` (50%). The rest is split by **share-months** (Σ shares held each month of the year), so mid-year share changes are weighted fairly. Only members **active** at calculation time receive a share. Amounts are whole taka, rounded down, and the few leftover taka go to the reserve. A loss or zero profit distributes nothing.
- Admins see a live preview for any year (labelled "estimate" until the year ends) and can **save** it. Saving recomputes on the server, allows one valid distribution per year, and can optionally record the payout as one `লভ্যাংশ` transaction. Voiding a distribution also voids that dividend transaction.
- Every member sees saved distributions, their own share highlighted, and the full list.

**Notices:** admins write notices at `/admin/notices` and can "সরিয়ে রাখুন" (archive) or restore them; nothing is deleted. Members see the latest 3 on the dashboard and all of them at `/notices`.

- New pages are linked from the আরও menu. New audit actions have Bengali labels.
- Tests: `tests/phase2-rules.test.ts`, `tests/proposals.test.ts`, `tests/profit-service.test.ts`.

## Quality pass (2026-10-04)

- **360px check:** every page (28 routes incl. admin and print) was loaded in a 360px-wide frame and measured for horizontal overflow. Only the two wide print tables overflowed on a phone screen. On screens they now scroll inside the document box; the printed A4 layout is unchanged.
- **Auth audit:** every page calls `requireMember`/`requireAdmin`, every admin action goes through `adminAction`, the CSV route requires an admin, and the cron route requires `CRON_SECRET`. The only public actions are login, logout, forgot-password and reset-password, by design.
- **New server-side guards** (the UI already prevented these, but the server didn't):
  - Payments only for months inside the ledger (start month … end of term, or the current month if later), and the payment date can't be in the future.
  - Transaction dates can't be in the future.
  - **Share changes can't start in a past month**, because that would rewrite old dues, contrary to spec §4. The one exception is a member with no share history yet (e.g. member ২২, flagged by the import), whose shares must start at October 2026.
- **Privacy:** on the printed member statement, phone and nominee phone are shown only to admins and to the member themself. Other members still see every amount (spec: full transparency of accounts).
- Tests that use 2027 dates now pin "today" with `vi.setSystemTime` (Date only), so they don't depend on when they run.

## Fixes from an independent review (2026-10-04)

- **Redirect loop after a password reset / role change / cancellation (high).** The proxy sent `/login` → `/` on the cookie signature alone, while `/` rejected the revoked session → endless loop with no way to log out. `/login` is now always reachable and decides with a DB check (`getCurrentMember`).
- **Lockout could be bypassed with parallel requests (high).** Each attempt now reserves a slot with one atomic `UPDATE` *before* bcrypt (`lib/auth/attempts.ts`); the 5th attempt sets the lock. Tested: 20 simultaneous guesses → exactly 5 checked.
- **A vote could slip in while a proposal was being closed** and be missing from the frozen tally → the vote trigger now reads the proposal `FOR SHARE` (migration `0008`), so it waits for the close and is then refused.
- **Profit for a year could be saved twice by a double submit** → partial unique index `profit_distributions(period_start) WHERE status='valid'` (migration `0007`) + friendly message; the payout date can't be in the future.
- **Payment retry could return another payment's receipt** → a reused `client_ref` must match member, months and amounts exactly, or it's an error; the form makes a new key whenever the details change.
- **Two admins demoting each other at once could leave no admin** → all active admin rows are locked during the check.
- **Password reset:** rate limit checked under a row lock; lookup + email happen in `after()`, so the response is identical (and equally fast) for unknown emails; using one link cancels the member's other open links.
- **Sheet mirror no longer contains phone numbers** (it may be shared with all members; phones are admin-only in the app). The Sunday full rewrite now holds the same lock as the incremental push.

## Quick deposit entry for admins (requested 2026-10-04)

- Admin home screen: two big buttons at the top — **জমা নিন** (green) and **আয়/ব্যয় যোগ**.
- **সদস্য** list: admins get a green **জমা** button on every active member's row → opens take-payment with that member pre-selected (oldest unpaid month and amount already filled).
- A member's account page: **জমা নিন** button for admins.
- These sit alongside the existing **জমা নিন** tab in the admin bottom bar and the button on `/admin/dues`.

## No upper limit on shares (samiti decision, 2026-10-04)

- The samiti decided a member may hold **any number of shares** (at least 1), replacing the constitution's 1–5 in `SAMITI_SPEC.md`. DB constraint is now `shares >= 1` (migration `0009`); forms use a number box showing the monthly amount; a soft cap of 999 only catches typos. The import no longer flags members with more than 5 shares (member ২২ was imported with 10). `content/rules.md` updated.
- **"Add member" made visible:** a **নতুন সদস্য** button on the সদস্য page and on the admin home screen (it previously lived only under আরও → সদস্য ব্যবস্থাপনা).

## Production database set up and members imported (2026-10-04)

- Neon project `somiti` (AWS Singapore, Postgres 17); all migrations applied.
- Imported from the old sheet: 32 members (6 admins), 32 share rows, 17 payments (৳১৫,০০০, R-0001…R-0017).
- Members ২৩ and ২৪ share ২২'s phone, and ২৬ shares ২৫'s; each phone can belong to one login only, so those three were imported **without a phone** (they log in with their member number; an admin can add their own phone later).
- Starting passwords were written to `import-passwords.txt` on the admin's PC (gitignored) instead of the terminal, so they never appeared in logs.

## Weekly backup live (2026-10-04)

- Private repo **RaHibBB/samiti-backups** (private on purpose: it holds every member's data; the app repo stays public).
- The workflow pushes with a **write deploy key** scoped to that one repo (`BACKUP_DEPLOY_KEY` secret) instead of a personal access token, so nothing else on the account is exposed. The key was generated locally, uploaded, and the local copies deleted.
- `DATABASE_URL` secret uses Neon's **direct** (non-pooled) host, as pg_dump needs.
- First run (manual) succeeded: `backups/2026-10-04.sql.gz` + 12 CSVs. **Restore verified**: the dump was downloaded and restored into a throwaway database → 32 members, 6 admins, 17 payments / ৳১৫,০০০, receipt sequence continues at 18, no-delete triggers present.
- `actions/checkout` bumped to v5 (v4 targets the deprecated Node 20 runtime).

## Admin ⇄ member view, and ease-of-use pass (2026-10-04)

- **Email (Gmail) skipped** by the samiti. The forgot-password page now says honestly "ask an admin for a temporary password" when no SMTP is configured in production (before, it claimed a link was sent). Admins reset from the member's page.
- **Admin ⇄ member view toggle:** a chip in the header (অ্যাডমিন ⇄ / সদস্য ⇄) and a row at the top of আরও. Member view shows exactly what members see — member bottom bar (আমার হিসাব), no admin buttons, opens on the admin's own account — with an amber bar to switch back. It is a **display preference only** (an httpOnly cookie, `samiti_view`); permissions are untouched: admin pages/actions still check the real role in the DB.
- **Admin home card "এই মাসের চাঁদা":** how many active members have fully paid this month (x/y), amount collected vs expected (progress bar), **today's receipts** (count + total, for handing over cash), and how many members owe money (taps through to বকেয়া).
- **Install as an app:** web manifest (`/manifest.webmanifest`, name "সমিতি", navy theme) and PNG icons generated with `next/og` (a stack of green coins on navy — shapes only, no font needed): browser tab, iPhone home-screen and Android 192/512. The proxy lets these load before login, as phones require.
- Login box hint now leads with mobile number / member number (most members have no email) and uses the normal keyboard.

## Bulk payments and due reminder (2026-10-04)

- **একসাথে জমা** (`/admin/pay/bulk`): pick a month (start … two months ahead), tick members (already-paid ones are greyed out, "সবাই" selects everyone still owing), choose method/date, save. Each ticked member gets their **full remaining amount for that month** as a normal payment with its own receipt (same service, audit and sheet outbox as single payments) and a WhatsApp receipt button. Amounts are recomputed on the server, never taken from the form. Partial payments stay on the normal জমা নিন screen.
  - Retry-safe: the batch has one random id; each member's payment uses `${batch}:${memberId}` as its `client_ref`, so re-submitting the same batch returns the existing receipts instead of paying twice.
  - Members that fail (e.g. cancelled meanwhile) are listed as skipped; the rest still save.
  - Reached from: জমা নিন page ("একসাথে অনেকের"), admin home (2×2 buttons), আরও.
- **Due reminder for members** (dashboard, under আমার বকেয়া): "অক্টোবর ২০২৬-এর চাঁদা ৳X — ১০/১০/২০২৬-এর মধ্যে দিন। আর N দিন বাকি।" (or "আজই শেষ দিন!"). Shown only while this month still has something unpaid and its due date hasn't passed; overdue months already show as বকেয়া. Logic in `dueReminder()` (`lib/ledger.ts`, unit-tested).

## Member-reported bKash/Nagad payments + monthly WhatsApp summary (2026-10-04)

- **বিকাশ/নগদে জমা জানান** (`/report`, button on every member's home screen and in আরও): the member picks month(s), amount (single month editable; several months = full remaining each), method (bKash/Nagad/Rocket/bank — never cash), **TrxID** (required), date and an optional note. Months already waiting for review aren't offered again. The member sees their reports with status (যাচাই বাকি / ✓ জমা হয়েছে / বাতিল + reason).
- **Nothing counts until an admin approves.** `/admin/reports` (pink "Nটি যাচাই বাকি" card on the admin home when any are waiting) shows member, amount, method, TrxID, date, months. **অনুমোদন** creates the real payment rows (receipts, audit, sheet outbox) inside the same DB transaction that closes the report (`client_ref = report:<id>`, so it can't double-book); the TrxID is stored on the payments. **বাতিল** needs a reason, which the member sees. Outcome is shown as a toast (the list refreshes immediately).
- New table `payment_reports` (migrations `0010`, `0011`): no deletes; reviewed exactly once (pending → approved/rejected, only review columns change, rejection needs a reason); method can't be cash; **the same TrxID can't be reported twice** (case/space-insensitive unique index, except after a rejection) and can't reuse a TrxID already on a valid payment.
- **মাসিক হিসাব WhatsApp গ্রুপে পাঠান** (admin home card): one tap opens WhatsApp with a ready message — this month's collection vs expected, x/y paid, everyone who still owes (name + amount, since accounts are transparent to all members), fund total (cash/invested) and a link to the printable monthly report. wa.me without a number, so the admin picks the group.
- Report links use the shared `appUrl()` (APP_URL → Vercel production domain → Host header only in dev).

## Google Sheet mirror live (2026-10-04)

- Mirror target = the samiti's existing sheet (`সমিতি_হিসাব_খাতা_2`, the one imported from), as the spec intended. The app added 4 tabs it owns — `Members`, `Payments`, `Transactions`, `Monthly Summary` — each with the read-only note in row 1. The original Bengali tabs are left untouched as history.
- Google Cloud project `somiti-bamon-sundor`, Sheets API enabled, service account `somiti-sheet-bamon-sundor@…iam.gserviceaccount.com` shared on the sheet as **Editor**; general access "Anyone with the link → Viewer".
- Vercel env: `GOOGLE_SERVICE_ACCOUNT_JSON` (Secret, pasted by the owner) and `SHEET_ID`. The key file stays only on the admin's PC as `service-account.json` (gitignored, plus a pattern for any downloaded `*-<12 hex>.json` key).
- First full rewrite verified against Neon: 32 members, 17 payments, ৳১৫,০০০ — identical. From now on each write updates the sheet within seconds; the daily cron retries failures and Sundays rewrite everything.
- The cron route now returns `{ ok:false, error }` (HTTP 502) instead of a bare 500, which is how the "API not enabled" and "not shared as Editor" problems were diagnosed.

## Public read access (samiti decision, 2026-10-04)

- **Anyone with the link can see all accounts without logging in** (members list, every member's account, grid, transactions, votes and results, profit distributions, notices, rules, print/PDF pages). Login is needed only to act as a person: my account, reporting a bKash/Nagad payment, voting, changing password, and everything admin.
- `proxy.ts` now requires a session only for `/admin`, `/me`, `/report`, `/settings`; it redirects to `/login?next=…` and login returns there (`safeNext` only allows same-site paths — blocks `//evil.com`, `/\evil.com`, full URLs). Public pages use `getViewer()` (member or null); all server actions still require a session/admin exactly as before.
- Visitors get a header **লগইন** button and a bottom bar without "আমার হিসাব" (হোম · সদস্য · গ্রিড · আয়-ব্যয় · আরও). The home page shows a welcome card with login, **this month's collection progress (now shown to everyone)**, open votes, the fund and notices; personal sections only after login; admin extras (today's cash, WhatsApp group button, যাচাই card) stay admin-only.
- **Kept private even now:** phone numbers and emails (admins only; a member sees their own on their printout) — verified 0 phone numbers on all public pages. Receipt photos were already public URLs.
- **Not indexed by search engines:** `robots.txt` disallows all and every page carries `noindex, nofollow`, so names and amounts don't appear in Google results even though the link is open.

## WhatsApp messages from the app (2026-10-04)

- **Member page → "…-কে WhatsApp-এ মেসেজ"** (admins only, collapsed by default): pick a ready message — হিসাবের সারাংশ (shares, total paid, dues with months, link to their public account page), বকেয়ার রিমাইন্ডার (only when they owe), or নিজে লিখুন — edit it freely, then **WhatsApp-এ পাঠান** opens WhatsApp to that member's number with the text filled in. No phone → WhatsApp asks whom to send to. Free (wa.me link), nothing is sent by the server.
- **Notices → "WhatsApp গ্রুপে পাঠান"** on every active notice (bold title, body, link to all notices).
- Visitors and members never get the composer, so phone numbers stay admin-only (verified: no `wa.me`/phone in the public member page).
- Existing WhatsApp spots unchanged: receipt after a payment, bulk-receipt buttons, dues reminders, monthly summary to the group.

## Review by Shuvo (admin), 2026-10-04

- **Wrong entry on member ১৪:** Shuvo set ১৪'s shares to 2 from November and took a November payment of ৳১,০০০ (R-0018) by mistake, which made the fund show ৳১৬,০০০ instead of ৳১৫,০০০. On Rahib's instruction R-0018 was **voided** (reason recorded, `voided_by` = Rahib); valid dues are back to ৳১৫,০০০ and the sheet shows it as বাতিল. (Rahib had separately set ১৪ to 2 shares from October, so October now shows ৳৫০০ remaining.)
- **"There's no delete option":** deleting is deliberately impossible (spec: data is never lost); **বাতিল is the delete**. It was only reachable via আরও → ভুল এন্ট্রি বাতিল, so it is now also: a **"ভুল হলে বাতিল"** button on every valid payment on the member's account page (admins), and **"ভুল হয়েছে? এখনই বাতিল করুন"** right on the take-payment success screen. The confirmation text explains that this is the delete, kept with a reason.
- **PDF authorisation:** every print page now ends with an authorisation block. If an **admin** downloads it: "ডাউনলোড ও প্রত্যয়ন করেছেন: <name> (অ্যাডমিন, সদস্য নং …)", the time, and a signature line under their name. For members/visitors the **default** is "সমিতির পক্ষে স্বাক্ষর" with a blank line and a note to get any admin's signature for certification. (The download itself is not written to the audit log — reading never writes.)

## Easier "জমা নিন" (take payment) page (2026-10-04)

- **Amount first.** The admin types what was handed over ("কত টাকা দিলেন?", big field, Bengali digits OK); `allocatePayment()` (lib/ledger.ts, tested) spreads it over the open months **oldest first** — full months, then a partial last month — and shows the breakdown ("নভেম্বর ৳১,৫০০ পুরো · জানুয়ারি ৳১,০০০ আংশিক"). Anything beyond the end of the term is flagged and can't be saved.
- **Quick amount chips:** ১ মাস · সব বকেয়া · ২/৩/৬ মাস, each with its amount (duplicates hidden).
- **Member list opens on "টাকা বাকি"** (overdue, or this month not yet fully paid) with a count, each row showing "বকেয়া ৳…" / "এই মাস ৳…" / "✓ পরিশোধিত"; "সবাই" shows everyone. Empty state when everyone has paid.
- The member card shows shares, monthly amount and which months are overdue; tapping it changes the member.
- **"মাস নিজে বাছাই করুন"** keeps the old month-by-month choice (2-column grid) for the rare case of skipping a month.
- Save button reads "সংরক্ষণ করুন · ৳২,৫০০ · ২ মাস"; one receipt per month as before; date/note stay tucked away (label shows "আজ"); success screen (receipts, WhatsApp, বাতিল) unchanged.
