import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";

/* ----------------------------------- COA ---------------------------------- */

export const accountType = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 24 }).notNull().unique(), // contoh "1-1120"
    name: varchar("name", { length: 200 }).notNull(),
    type: accountType("type").notNull(),
    group: varchar("group", { length: 40 }),
    description: text("description"),
    parentId: uuid("parent_id"),
    isPostable: boolean("is_postable").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    isSystem: boolean("is_system").notNull().default(false),
    openingBalance: bigint("opening_balance", { mode: "bigint" }).notNull().default(sql`0`),
    ...timestamps,
  },
  (t) => [index("accounts_code_uidx").on(t.code), index("accounts_type_idx").on(t.type)]
);

/* -------------------------------- Jurnal ---------------------------------- */

export const journalType = pgEnum("journal_type", [
  "OPENING",
  "SALES",
  "PAYMENT",
  "RECEIPT",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "EXPENSE",
  "INCOME",
  "PRODUCTION",
  "HPP",
  "PAYROLL",
  "ADJUSTMENT",
  "REVERSAL",
]);

export const journalStatus = pgEnum("journal_status", [
  "DRAFT",
  "POSTED",
  "REVERSED",
]);

export const journals = pgTable(
  "journals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalNumber: varchar("journal_number", { length: 40 }).notNull().unique(),
    branchId: uuid("branch_id").references(() => branches.id),
    journalDate: timestamp("journal_date", { withTimezone: true }).notNull().defaultNow(),
    type: journalType("type").notNull(),
    status: journalStatus("status").notNull().default("DRAFT"),
    description: text("description").notNull(),
    sourceModule: varchar("source_module", { length: 60 }),
    sourceEntityType: varchar("source_entity_type", { length: 40 }),
    sourceEntityId: varchar("source_entity_id", { length: 64 }),
    debitTotal: bigint("debit_total", { mode: "bigint" }).notNull().default(sql`0`),
    creditTotal: bigint("credit_total", { mode: "bigint" }).notNull().default(sql`0`),
    reversalOfId: uuid("reversal_of_id"),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("journals_branch_date_idx").on(t.branchId, t.journalDate),
    index("journals_status_idx").on(t.status),
    index("journals_source_idx").on(t.sourceModule, t.sourceEntityId),
  ]
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    debit: bigint("debit", { mode: "bigint" }).notNull().default(sql`0`),
    credit: bigint("credit", { mode: "bigint" }).notNull().default(sql`0`),
    description: text("description"),
    referenceType: varchar("reference_type", { length: 40 }),
    ...timestamps,
  },
  (t) => [
    index("journal_lines_journal_idx").on(t.journalId),
    index("journal_lines_account_idx").on(t.accountId),
  ]
);

/* ------------------------------ Kas & Bank -------------------------------- */

export const cashAccountType = pgEnum("cash_account_type", ["BANK", "CASH", "EWALLET", "VA"]);

export const cashAccounts = pgTable(
  "cash_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    name: varchar("name", { length: 160 }).notNull(),
    type: cashAccountType("type").notNull().default("BANK"),
    bankName: varchar("bank_name", { length: 120 }),
    accountNumber: varchar("account_number", { length: 40 }),
    openingBalance: bigint("opening_balance", { mode: "bigint" }).notNull().default(sql`0`),
    isActive: boolean("is_active").notNull().default(true),
    coaDriverId: uuid("coa_driver_id"),
    ...timestamps,
  },
  (t) => [index("cash_accounts_branch_idx").on(t.branchId)]
);