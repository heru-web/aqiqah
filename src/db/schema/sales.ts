import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";
import { customers, leads } from "./crm";
import { businessUnits, salesChannels } from "./performance";

export const orderStatus = pgEnum("order_status", [
  "DRAFT",
  "ORDER_CONFIRMED",
  "ANIMALS_SIAAP",
  "SLAUGHTERED",
  "KARKAS_FILLET",
  "KITCHEN_COOKED",
  "PACKED",
  "QC_READY",
  "READY_DISPATCH",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

export const orderLifecycle: string[] = [
  "ORDER_CONFIRMED",
  "ANIMALS_SIAAP",
  "SLAUGHTERED",
  "KARKAS_FILLET",
  "KITCHEN_COOKED",
  "PACKED",
  "QC_READY",
  "READY_DISPATCH",
  "DELIVERED",
  "COMPLETED",
];

export const lineKind = pgEnum("line_kind", ["PAKET", "PRODUK", "ANIMAL", "SERVICE"]);

export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    quoteNumber: varchar("quote_number", { length: 32 }).notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    status: varchar("status", { length: 16 }).notNull().default("DRAFT"), // DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED|VOID
    validUntil: timestamp("valid_until", { withTimezone: true }),
    itemsTotal: bigint("items_total", { mode: "bigint" }).notNull().default(sql`0`),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    shippingAmount: bigint("shipping_amount", { mode: "bigint" }).notNull().default(sql`0`),
    rounding: bigint("rounding", { mode: "bigint" }).notNull().default(sql`0`),
    total: bigint("total", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    terms: text("terms"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("quotations_branch_idx").on(t.branchId),
    index("quotations_customer_idx").on(t.customerId),
    index("quotations_status_idx").on(t.status),
  ]
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    kind: lineKind("kind").notNull(),
    entityId: uuid("entity_id"),
    variantId: uuid("variant_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "bigint" }).notNull().default(sql`0`),
    discountBps: integer("discount_bps").notNull().default(0),
    lineTotal: bigint("line_total", { mode: "bigint" }).notNull().default(sql`0`),
    ...timestamps,
  },
  (t) => [index("quote_items_quote_idx").on(t.quotationId)]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    quoteId: uuid("quote_id").references(() => quotations.id, { onDelete: "set null" }),
    status: orderStatus("status").notNull().default("DRAFT"),

    // Atribusi KPI (manajemen kinerja)
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => salesChannels.id, { onDelete: "set null" }),

    // Aqiqah & Shohibul
    aqiqahType: varchar("aqiqah_type", { length: 24 }).notNull().default("AKIKAH"), // AKIKAH|TASMIYAH|DONASI
    shohibulName: varchar("shohibul_name", { length: 200 }),
    shohibulGender: varchar("shohibul_gender", { length: 8 }),
    childName: varchar("child_name", { length: 200 }),
    bornDate: timestamp("born_date", { withTimezone: true }),
    aqiqahDay: integer("aqiqah_day"), // hari ke-7/14/21
    aqiqahDate: timestamp("aqiqah_date", { withTimezone: true }),

    // Pengiriman
    deliveryDate: timestamp("delivery_date", { withTimezone: true }),
    deliveryTimeSlot: varchar("delivery_time_slot", { length: 40 }),
    recipientName: varchar("recipient_name", { length: 200 }),
    recipientPhone: varchar("recipient_phone", { length: 32 }),
    deliveryAddress: text("delivery_address"),
    deliveryCity: varchar("delivery_city", { length: 80 }),
    deliveryDistrict: varchar("delivery_district", { length: 80 }),
    deliveryLandmark: text("delivery_landmark"),
    gpsCoordinates: varchar("gps_coordinates", { length: 80 }),
    deliveryNote: text("delivery_note"),

    // Finansial
    itemsTotal: bigint("items_total", { mode: "bigint" }).notNull().default(sql`0`),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    shippingAmount: bigint("shipping_amount", { mode: "bigint" }).notNull().default(sql`0`),
    rounding: bigint("rounding", { mode: "bigint" }).notNull().default(sql`0`),
    total: bigint("total", { mode: "bigint" }).notNull().default(sql`0`),
    paidConfirmed: bigint("paid_confirmed", { mode: "bigint" }).notNull().default(sql`0`),
    balance: bigint("balance", { mode: "bigint" }).notNull().default(sql`0`),
    voucherId: uuid("voucher_id"),

    channel: varchar("channel", { length: 40 }),
    referralSource: varchar("referral_source", { length: 120 }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_branch_status_idx").on(t.branchId, t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_delivery_date_idx").on(t.deliveryDate),
    index("orders_number_uidx").on(t.orderNumber),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: lineKind("kind").notNull(),
    entityId: uuid("entity_id"),
    variantId: uuid("variant_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "bigint" }).notNull().default(sql`0`),
    discountBps: integer("discount_bps").notNull().default(0),
    lineTotal: bigint("line_total", { mode: "bigint" }).notNull().default(sql`0`),
    ...timestamps,
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);

export const orderStatusLogs = pgTable(
  "order_status_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_logs_order_idx").on(t.orderId)]
);

export const invoiceStatus = pgEnum("invoice_status", [
  "DRAFT",
  "ISSUED",
  "PARTIAL",
  "PAID",
  "VOID",
  "BAD_DEBT",
]);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    invoiceNumber: varchar("invoice_number", { length: 32 }).notNull().unique(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    status: invoiceStatus("status").notNull().default("DRAFT"),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
    issueDate: timestamp("issue_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    itemsTotal: bigint("items_total", { mode: "bigint" }).notNull().default(sql`0`),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    shippingAmount: bigint("shipping_amount", { mode: "bigint" }).notNull().default(sql`0`),
    rounding: bigint("rounding", { mode: "bigint" }).notNull().default(sql`0`),
    total: bigint("total", { mode: "bigint" }).notNull().default(sql`0`),
    totalPaid: bigint("total_paid", { mode: "bigint" }).notNull().default(sql`0`),
    balance: bigint("balance", { mode: "bigint" }).notNull().default(sql`0`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("invoices_branch_status_idx").on(t.branchId, t.status),
    index("invoices_customer_idx").on(t.customerId),
  ]
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    kind: lineKind("kind").notNull(),
    entityId: uuid("entity_id"),
    variantId: uuid("variant_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotal: bigint("line_total", { mode: "bigint" }).notNull().default(sql`0`),
    ...timestamps,
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)]
);

export const paymentMethod = pgEnum("payment_method", [
  "TRANSFER",
  "VA",
  "QRIS",
  "EWALLET",
  "CASH",
  "CARD",
]);

export const paymentStatus = pgEnum("payment_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
  "REVERSED",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    paymentNumber: varchar("payment_number", { length: 32 }).notNull().unique(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    method: paymentMethod("method").notNull().default("TRANSFER"),
    provider: varchar("provider", { length: 40 }), // BSI_VA | XENDIT | ...
    providerRef: varchar("provider_ref", { length: 160 }),
    status: paymentStatus("status").notNull().default("PENDING"),
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    bankFrom: varchar("bank_from", { length: 80 }),
    bankTo: varchar("bank_to", { length: 80 }),
    senderName: varchar("sender_name", { length: 200 }),
    notes: text("notes"),
    reconciliationStatus: varchar("reconciliation_status", { length: 24 }).notNull().default("NONE"), // NONE|MATCHED|UNMATCHED|REVIEW
    receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("payments_branch_status_idx").on(t.branchId, t.status),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_provider_ref_idx").on(t.provider, t.providerRef),
  ]
);

export const receivableStatus = pgEnum("receivable_status", [
  "OPEN",
  "PARTIAL",
  "SETTLED",
  "BAD_DEBT",
]);

export const receivables = pgTable(
  "receivables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    settledAmount: bigint("settled_amount", { mode: "bigint" }).notNull().default(sql`0`),
    balance: bigint("balance", { mode: "bigint" }).notNull().default(sql`0`),
    status: receivableStatus("status").notNull().default("OPEN"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("receivables_customer_idx").on(t.customerId), index("receivables_balance_idx").on(t.balance)]
);

export const voucherType = pgEnum("voucher_type", ["NOMINAL", "PERCENT", "FREE_DELIVERY"]);

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull().unique(),
    type: voucherType("type").notNull(),
    nominalAmount: bigint("nominal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    percentBps: integer("percent_bps").notNull().default(0),
    maxUsage: integer("max_usage"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("vouchers_code_uidx").on(t.code)]
);

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("voucher_redemption_order_idx").on(t.orderId)]
);