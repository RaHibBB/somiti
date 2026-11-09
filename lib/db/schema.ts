import { sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

// ── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("member_role", ["member", "admin"])
export const memberStatusEnum = pgEnum("member_status", ["active", "cancelled"])
export const recordStatusEnum = pgEnum("record_status", ["valid", "void"])
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bkash", "nagad", "rocket", "bank"])
export const txnTypeEnum = pgEnum("txn_type", [
  "expense",
  "investment",
  "business_income",
  "investment_return",
  "bank_profit",
  "member_refund",
  "dividend",
])
// Where a transaction's money came from / went to: the samiti's bank account, or cash an admin holds.
export const txnViaEnum = pgEnum("txn_via", ["bank", "cash"])
export const noticeStatusEnum = pgEnum("notice_status", ["active", "archived"])
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "done", "failed"])
export const reportStatusEnum = pgEnum("report_status", ["pending", "approved", "rejected"])
// Phase 2
export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "open", "passed", "rejected", "invalid"])
export const voteChoiceEnum = pgEnum("vote_choice", ["yes", "no"])

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

// Receipt numbers come from a sequence so they are gap-tolerant but never reused.
export const receiptNoSeq = pgSequence("receipt_no_seq", { startWith: 1, increment: 1 })

// ── Members ──────────────────────────────────────────────────────────────────
export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    memberNo: integer("member_no").notNull().unique(),
    nameBn: text("name_bn").notNull(),
    // Not unique: a family may share one mobile number (login then goes by each member's password).
    phone: varchar("phone", { length: 16 }),
    // Optional login + password-reset address, stored lower-case.
    email: varchar("email", { length: 254 }).unique(),
    role: roleEnum("role").notNull().default("member"),
    status: memberStatusEnum("status").notNull().default("active"),
    joinedOn: date("joined_on", { mode: "string" }).notNull(),
    nomineeName: text("nominee_name"),
    nomineePhone: varchar("nominee_phone", { length: 16 }),
    // Password hash (bcrypt). Column keeps its original name; it now holds any password, not only a 6-digit PIN.
    pinHash: text("pin_hash"),
    mustChangePin: boolean("must_change_pin").notNull().default(true),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    sessionVersion: integer("session_version").notNull().default(1),
    // Notification kinds this member turned off (see lib/notify-kinds.ts). Empty = everything on.
    notifyOff: text("notify_off").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("members_phone_format", sql`${t.phone} IS NULL OR ${t.phone} ~ '^(01[3-9][0-9]{8}|[+][1-9][0-9]{7,14})$'`),
    index("members_phone_idx").on(t.phone),
    check("members_email_lowercase", sql`${t.email} IS NULL OR ${t.email} = lower(${t.email})`),
    check("members_nominee_phone_format", sql`${t.nomineePhone} IS NULL OR ${t.nomineePhone} ~ '^(01[3-9][0-9]{8}|[+][1-9][0-9]{7,14})$'`),
    check("members_member_no_positive", sql`${t.memberNo} > 0`),
  ],
)

// A member's shares for month M = latest row (by effective_month, then id) with effective_month <= M.
export const shareHistory = pgTable(
  "share_history",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    shares: smallint("shares").notNull(),
    effectiveMonth: date("effective_month", { mode: "string" }).notNull(),
    setBy: integer("set_by").references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [
    // No upper limit (samiti decision 2026-10-04, replacing the constitution's 1–5).
    check("share_history_shares_positive", sql`${t.shares} >= 1`),
    check("share_history_first_of_month", sql`EXTRACT(DAY FROM ${t.effectiveMonth}) = 1`),
    index("share_history_member_idx").on(t.memberId, t.effectiveMonth),
  ],
)

// ── Settings (single row, id = 1) ────────────────────────────────────────────
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    sharePrice: integer("share_price").notNull().default(500),
    startMonth: date("start_month", { mode: "string" }).notNull().default("2026-10-01"),
    dueDay: smallint("due_day").notNull().default(10),
    termMonths: smallint("term_months").notNull().default(36),
    reservePct: smallint("reserve_pct").notNull().default(50),
    maxInvestPct: smallint("max_invest_pct").notNull().default(70),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("settings_single_row", sql`${t.id} = 1`),
    check("settings_due_day_range", sql`${t.dueDay} BETWEEN 1 AND 28`),
    check("settings_start_first_of_month", sql`EXTRACT(DAY FROM ${t.startMonth}) = 1`),
  ],
)

// ── Payments (monthly dues) ──────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    receiptNo: integer("receipt_no")
      .notNull()
      .unique()
      .default(sql`nextval('receipt_no_seq')`),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    forMonth: date("for_month", { mode: "string" }).notNull(),
    amount: integer("amount").notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    trxId: text("trx_id"),
    receivedBy: integer("received_by").references(() => members.id),
    note: text("note"),
    // Random id from the take-payment form; makes a double-tap / retry on a slow connection idempotent.
    clientRef: text("client_ref"),
    status: recordStatusEnum("status").notNull().default("valid"),
    voidReason: text("void_reason"),
    voidedBy: integer("voided_by").references(() => members.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("payments_client_ref_month").on(t.clientRef, t.forMonth),
    check("payments_amount_positive", sql`${t.amount} > 0`),
    check("payments_first_of_month", sql`EXTRACT(DAY FROM ${t.forMonth}) = 1`),
    check(
      "payments_void_has_reason",
      sql`${t.status} = 'valid' OR (${t.voidReason} IS NOT NULL AND length(trim(${t.voidReason})) > 0 AND ${t.voidedAt} IS NOT NULL)`,
    ),
    index("payments_member_idx").on(t.memberId, t.forMonth),
  ],
)

// ── Transactions (non-dues money) ────────────────────────────────────────────
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    type: txnTypeEnum("type").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    // Free text: who approved (e.g. "সভার সিদ্ধান্ত" or admin names). The admin who entered it is created_by.
    approvedBy: text("approved_by"),
    createdBy: integer("created_by").references(() => members.id),
    receiptUrl: text("receipt_url"),
    meetingDate: date("meeting_date", { mode: "string" }),
    voteResult: text("vote_result"),
    // Set when an investment is made under a passed proposal (Phase 2).
    proposalId: integer("proposal_id").references(() => proposals.id),
    // Paid from / received into the bank (default) or an admin's cash in hand (then cash_holder_id says whose).
    via: txnViaEnum("via").notNull().default("bank"),
    cashHolderId: integer("cash_holder_id").references(() => members.id),
    // The project (e.g. a cow) this money belongs to; null = the samiti's general accounts.
    projectId: integer("project_id").references(() => projects.id),
    // Free-text heading inside a project, e.g. "খাবার", "ওষুধ", "বিক্রি" (presets in lib/projects.ts).
    category: text("category"),
    status: recordStatusEnum("status").notNull().default("valid"),
    voidReason: text("void_reason"),
    voidedBy: integer("voided_by").references(() => members.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check("transactions_cash_has_holder", sql`${t.via} = 'bank' OR ${t.cashHolderId} IS NOT NULL`),
    // Inside a project only: purchase/capital (investment), costs (expense), income (business_income).
    check("transactions_project_types", sql`${t.projectId} IS NULL OR ${t.type} IN ('investment', 'expense', 'business_income')`),
    check(
      "transactions_void_has_reason",
      sql`${t.status} = 'valid' OR (${t.voidReason} IS NOT NULL AND length(trim(${t.voidReason})) > 0 AND ${t.voidedAt} IS NOT NULL)`,
    ),
    index("transactions_date_idx").on(t.date),
    index("transactions_project_idx").on(t.projectId),
  ],
)

// ── Projects (investments with their own accounts, e.g. a cow) ──────────────
// Every cost and income of a project is a transaction with project_id set. While a project is
// open, the money spent on it counts as "invested"; when it is closed, its profit or loss
// (income − purchase − costs) counts in the samiti year of the closing date.
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    proposalId: integer("proposal_id").references(() => proposals.id),
    budget: integer("budget"),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    createdBy: integer("created_by").references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("projects_name_not_blank", sql`length(trim(${t.name})) > 0`),
    check("projects_budget_positive", sql`${t.budget} IS NULL OR ${t.budget} > 0`),
  ],
)

// Close / reopen history of a project (insert-only). The latest row is the project's state.
export const projectEvents = pgTable(
  "project_events",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    kind: text("kind", { enum: ["close", "reopen"] }).notNull(),
    // For "close": the date the project ended (sale date) — decides which year its profit counts in.
    eventDate: date("event_date", { mode: "string" }).notNull(),
    reason: text("reason"),
    byId: integer("by_id")
      .notNull()
      .references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("project_events_project_idx").on(t.projectId, t.id),
    check("project_reopen_has_reason", sql`${t.kind} = 'close' OR (${t.reason} IS NOT NULL AND length(trim(${t.reason})) > 0)`),
  ],
)

// ── Notices ──────────────────────────────────────────────────────────────────
export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: integer("created_by").references(() => members.id),
  createdAt: createdAt(),
  status: noticeStatusEnum("status").notNull().default("active"),
})

// ── Audit log (insert-only, enforced by trigger) ─────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: integer("actor_id").references(() => members.id),
    action: text("action").notNull(),
    tableName: text("table_name").notNull(),
    rowId: text("row_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_row_idx").on(t.tableName, t.rowId)],
)

// ── Password reset tokens (only the SHA-256 of the token is stored) ─────────
export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("password_resets_member_idx").on(t.memberId, t.createdAt)],
)

// ── Who holds the money: corrections ──────────────────────────────────────────
// payments.received_by is frozen with the payment. If it was recorded wrongly, an admin adds a row
// here; the latest row for a payment is the effective holder. Insert-only, so the history stays.
export const paymentReceivers = pgTable(
  "payment_receivers",
  {
    id: serial("id").primaryKey(),
    paymentId: integer("payment_id")
      .notNull()
      .references(() => payments.id),
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => members.id),
    setBy: integer("set_by")
      .notNull()
      .references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [index("payment_receivers_payment_idx").on(t.paymentId, t.id)],
)

// ── Month close ───────────────────────────────────────────────────────────────
// An admin closes a month ("this month's accounts are final"); reopening needs a reason. Events are
// insert-only; the latest event per month says whether it is closed. `snapshot` keeps the numbers
// as they were when closed.
export const monthCloseEvents = pgTable(
  "month_close_events",
  {
    id: serial("id").primaryKey(),
    month: date("month", { mode: "string" }).notNull(),
    kind: text("kind", { enum: ["close", "reopen"] }).notNull(),
    reason: text("reason"),
    snapshot: jsonb("snapshot"),
    byId: integer("by_id")
      .notNull()
      .references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("month_close_events_month_idx").on(t.month, t.id),
    check("month_close_first_of_month", sql`EXTRACT(DAY FROM ${t.month}) = 1`),
    check("month_reopen_has_reason", sql`${t.kind} = 'close' OR (${t.reason} IS NOT NULL AND length(trim(${t.reason})) > 0)`),
  ],
)

// ── Money handed over: admin → bank, or admin → another admin ─────────────────
// Together with payments.received_by this gives "how much does each admin still hold".
export const cashHandovers = pgTable(
  "cash_handovers",
  {
    id: serial("id").primaryKey(),
    fromId: integer("from_id")
      .notNull()
      .references(() => members.id),
    // null = deposited in the samiti's bank account
    toId: integer("to_id").references(() => members.id),
    amount: integer("amount").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => members.id),
    status: recordStatusEnum("status").notNull().default("valid"),
    voidReason: text("void_reason"),
    voidedBy: integer("voided_by").references(() => members.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("cash_handovers_amount_positive", sql`${t.amount} > 0`),
    check("cash_handovers_not_to_self", sql`${t.toId} IS NULL OR ${t.toId} <> ${t.fromId}`),
    check(
      "cash_handovers_void_has_reason",
      sql`${t.status} = 'valid' OR (${t.voidReason} IS NOT NULL AND length(trim(${t.voidReason})) > 0 AND ${t.voidedAt} IS NOT NULL)`,
    ),
  ],
)
export type CashHandover = typeof cashHandovers.$inferSelect

// ── Date corrections ──────────────────────────────────────────────────────────
// payments.paid_on is frozen with the payment. A wrongly dated payment gets a row here; the latest
// row is the effective date. Insert-only, so the history stays.
export const paymentDateFixes = pgTable(
  "payment_date_fixes",
  {
    id: serial("id").primaryKey(),
    paymentId: integer("payment_id")
      .notNull()
      .references(() => payments.id),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    setBy: integer("set_by")
      .notNull()
      .references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [index("payment_date_fixes_payment_idx").on(t.paymentId, t.id)],
)

// ── Member-reported mobile payments (bKash/Nagad/…), approved by an admin ─────
// The member says "I sent ৳X for these months, trx id Y"; an admin checks the wallet and
// approves (→ real payment rows, receipts) or rejects with a reason.
export const paymentReports = pgTable(
  "payment_reports",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    items: jsonb("items").$type<{ forMonth: string; amount: number }[]>().notNull(),
    amount: integer("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    trxId: text("trx_id").notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    status: reportStatusEnum("status").notNull().default("pending"),
    reviewedBy: integer("reviewed_by").references(() => members.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),
    paymentIds: jsonb("payment_ids").$type<number[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    check("payment_reports_amount_positive", sql`${t.amount} > 0`),
    check("payment_reports_not_cash", sql`${t.method} <> 'cash'`),
    check("payment_reports_trx_present", sql`length(trim(${t.trxId})) >= 4`),
    // The same transaction id can't be reported twice (unless an earlier report was rejected).
    uniqueIndex("payment_reports_trx_once").on(sql`upper(trim(${t.trxId}))`).where(sql`status <> 'rejected'`),
    index("payment_reports_status_idx").on(t.status, t.createdAt),
  ],
)

// ── Google Sheet outbox ──────────────────────────────────────────────────────
export const sheetOutbox = pgTable(
  "sheet_outbox",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("sheet_outbox_status_idx").on(t.status, t.id)],
)

// ── Phase 2 tables (no UI yet) ───────────────────────────────────────────────
export const proposals = pgTable(
  "proposals",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    amount: integer("amount"),
    createdBy: integer("created_by").references(() => members.id),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    status: proposalStatusEnum("status").notNull().default("draft"),
    activeMembersAtClose: integer("active_members_at_close"),
    yesCount: integer("yes_count"),
    noCount: integer("no_count"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: integer("closed_by").references(() => members.id),
    createdAt: createdAt(),
  },
  (t) => [check("proposals_amount_positive", sql`${t.amount} IS NULL OR ${t.amount} > 0`)],
)

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposals.id),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    choice: voteChoiceEnum("choice").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("votes_one_per_member").on(t.proposalId, t.memberId)],
)

export const profitDistributions = pgTable(
  "profit_distributions",
  {
  id: serial("id").primaryKey(),
  periodLabel: text("period_label").notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  totalProfit: integer("total_profit").notNull(),
  reserveAmount: integer("reserve_amount").notNull(),
  distributedAmount: integer("distributed_amount").notNull(),
  details: jsonb("details"),
  createdBy: integer("created_by").references(() => members.id),
  status: recordStatusEnum("status").notNull().default("valid"),
  voidReason: text("void_reason"),
  voidedBy: integer("voided_by").references(() => members.id),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  createdAt: createdAt(),
  },
  // At most one valid distribution per samiti year (protects against double submits).
  (t) => [uniqueIndex("profit_distributions_one_valid_per_year").on(t.periodStart).where(sql`status = 'valid'`)],
)

// ── Notifications ───────────────────────────────────────────────────────────
// One row per browser/phone that allowed push notifications. Not money data: rows are removed
// when the push service says the subscription is gone, or when the member turns it off.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_member_idx").on(t.memberId)],
)

// The in-app inbox (bell). Every notification is stored here, push or not.
// dedupe_key stops a daily reminder from being sent twice (e.g. "due:2026-11:31").
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    dedupeKey: text("dedupe_key").unique(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId, t.id)],
)

export type Member = typeof members.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Project = typeof projects.$inferSelect
export type ShareHistoryRow = typeof shareHistory.$inferSelect
export type Settings = typeof settings.$inferSelect
export type AuditEntry = typeof auditLog.$inferSelect
export type Notice = typeof notices.$inferSelect
export type PaymentReport = typeof paymentReports.$inferSelect
