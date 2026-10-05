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
    phone: varchar("phone", { length: 16 }).unique(),
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
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("members_phone_format", sql`${t.phone} IS NULL OR ${t.phone} ~ '^(01[3-9][0-9]{8}|[+][1-9][0-9]{7,14})$'`),
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
    status: recordStatusEnum("status").notNull().default("valid"),
    voidReason: text("void_reason"),
    voidedBy: integer("voided_by").references(() => members.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check(
      "transactions_void_has_reason",
      sql`${t.status} = 'valid' OR (${t.voidReason} IS NOT NULL AND length(trim(${t.voidReason})) > 0 AND ${t.voidedAt} IS NOT NULL)`,
    ),
    index("transactions_date_idx").on(t.date),
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
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
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

export type Member = typeof members.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type ShareHistoryRow = typeof shareHistory.$inferSelect
export type Settings = typeof settings.$inferSelect
export type AuditEntry = typeof auditLog.$inferSelect
export type Notice = typeof notices.$inferSelect
export type PaymentReport = typeof paymentReports.$inferSelect
