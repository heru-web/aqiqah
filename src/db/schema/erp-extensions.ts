import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { branches, timestamps, users } from "./core";
import { orders } from "./sales";
import { accounts } from "./finance";
import { employees } from "./performance";

/* ── Inventaris (minimum viable: item + kartu stok) ─────────────────── */

export const inventoryDirection = pgEnum("inventory_direction", ["IN", "OUT", "ADJUST"]);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 40 }).notNull().default("BAHAN"),
    unit: varchar("unit", { length: 24 }).notNull().default("buah"),
    qty: integer("qty").notNull().default(0),
    minQty: integer("min_qty").notNull().default(0),
    location: varchar("location", { length: 140 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("inventory_items_branch_idx").on(t.branchId), index("inventory_items_cat_idx").on(t.category)]
);

export const inventoryMoves = pgTable(
  "inventory_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    direction: inventoryDirection("direction").notNull(),
    qty: integer("qty").notNull(),
    reason: varchar("reason", { length: 200 }),
    refModule: varchar("ref_module", { length: 40 }),
    refId: varchar("ref_id", { length: 64 }),
    /** Harga satuan (IN = harga beli; OUT = HPP FIFO). */
    unitCost: bigint("unit_cost", { mode: "bigint" }),
    /** Nilai total pergerakan (qty x unitCost; OUT = total HPP FIFO). */
    totalCost: bigint("total_cost", { mode: "bigint" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("inventory_moves_item_idx").on(t.itemId)]
);

/** Lot stok masuk — sumber perhitungan FIFO & HPP. */
export const inventoryLots = pgTable(
  "inventory_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    refModule: varchar("ref_module", { length: 40 }),
    refId: varchar("ref_id", { length: 64 }),
    qtyIn: integer("qty_in").notNull(),
    qtyRemaining: integer("qty_remaining").notNull(),
    unitCost: bigint("unit_cost", { mode: "bigint" }).notNull().default(sql`0`),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("inventory_lots_item_idx").on(t.itemId, t.receivedAt)]
);

/* ── Payroll (minimum viable: run + lines) ─────────────────────────── */

export const payrollStatus = pgEnum("payroll_status", ["DRAFT", "FINAL"]);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
    status: payrollStatus("status").notNull().default("DRAFT"),
    note: text("note"),
    totalNet: bigint("total_net", { mode: "bigint" }).notNull().default(sql`0`),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedBy: uuid("finalized_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("payroll_runs_branch_idx").on(t.branchId, t.period)]
);

export const payrollLines = pgTable(
  "payroll_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    employeeNumber: varchar("employee_number", { length: 24 }).notNull(),
    employeeName: varchar("employee_name", { length: 160 }).notNull(),
    basic: bigint("basic", { mode: "bigint" }).notNull().default(sql`0`),
    allowance: bigint("allowance", { mode: "bigint" }).notNull().default(sql`0`),
    deduction: bigint("deduction", { mode: "bigint" }).notNull().default(sql`0`),
    net: bigint("net", { mode: "bigint" }).notNull().default(sql`0`),
    note: varchar("note", { length: 200 }),
    ...timestamps,
  },
  (t) => [index("payroll_lines_run_idx").on(t.runId)]
);

/* ── Kasbon ───────────────────────────────────────────────────────── */

export const kasbonStatus = pgEnum("kasbon_status", ["PENGAJUAN", "DISETUJUI", "DIBAYAR", "DIBATALKAN"]);

export const kasbons = pgTable(
  "kasbons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    employeeName: varchar("employee_name", { length: 160 }).notNull(),
    employeeNumber: varchar("employee_number", { length: 24 }).notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    reason: varchar("reason", { length: 200 }),
    status: kasbonStatus("status").notNull().default("PENGAJUAN"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    repaidAt: timestamp("repaid_at", { withTimezone: true }),
    note: varchar("note", { length: 200 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("kasbons_branch_idx").on(t.branchId), index("kasbons_status_idx").on(t.status)]
);

/* ── ZISWAF ───────────────────────────────────────────────────────── */

export const ziswafKind = pgEnum("ziswaf_kind", ["ZAKAT", "INFAK", "SEDEKAH", "WAKAF"]);
export const ziswafDirection = pgEnum("ziswaf_direction", ["IN", "OUT"]);

export const ziswafEntries = pgTable(
  "ziswaf_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    kind: ziswafKind("kind").notNull(),
    direction: ziswafDirection("direction").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    party: varchar("party", { length: 200 }).notNull(), // muzakki / mustahik
    eventDate: timestamp("event_date", { withTimezone: true }).defaultNow().notNull(),
    note: varchar("note", { length: 200 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("ziswaf_branch_idx").on(t.branchId), index("ziswaf_kind_idx").on(t.kind)]
);

/* ── Produksi (batch minimum viable) ─────────────────────────────── */

export const prodStage = pgEnum("prod_stage", ["RPH", "POTONG", "MASAK", "PACKING", "QC", "SIAP"]);
export const qcStatus = pgEnum("qc_status", ["PENDING", "PASS", "FAIL"]);

export const productionBatches = pgTable(
  "production_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    inventoryItemId: uuid("inventoryItemId").references(() => inventoryItems.id, { onDelete: "set null" }),
    batchNumber: varchar("batch_number", { length: 32 }).notNull().unique(),
    itemName: varchar("item_name", { length: 200 }).notNull(),
    qtyPlanned: integer("qty_planned").notNull().default(0),
    qtyDone: integer("qty_done").notNull().default(0),
    waste: integer("waste").notNull().default(0),
    stage: prodStage("stage").notNull().default("RPH"),
    qcStatus: qcStatus("qc_status").notNull().default("PENDING"),
    notes: varchar("notes", { length: 200 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("prod_batch_branch_idx").on(t.branchId), index("prod_batch_stage_idx").on(t.stage)]
);

/* ── Pengiriman (minimum viable) ─────────────────────────────────── */

// Reuse the existing delivery enum; the schema must have one definition per SQL type.
import { deliveryStatus } from "./ops";

export const deliveryTasks = pgTable(
  "delivery_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: uuid("orderId").references(() => orders.id, { onDelete: "set null" }),
    destination: varchar("destination", { length: 240 }).notNull(),
    contactName: varchar("contact_name", { length: 120 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    driverName: varchar("driver_name", { length: 120 }),
    vehiclePlate: varchar("vehicle_plate", { length: 32 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: deliveryStatus("status").notNull().default("WAITING"),
    trackingToken: varchar("tracking_token", { length: 40 }).unique(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    notes: varchar("notes", { length: 200 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    podRecipientName: varchar("pod_recipient_name", { length: 160 }),
    podPhotoUrl: text("pod_photo_url"),
    podSignatureUrl: text("pod_signature_url"),
    podTempC: integer("pod_temp_c"),
    podGeo: varchar("pod_geo", { length: 80 }),
    podChecklist: text("pod_checklist"),
    podNotes: varchar("pod_notes", { length: 240 }),
    podAt: timestamp("pod_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("delivery_branch_idx").on(t.branchId), index("delivery_status_idx").on(t.status)]
);

/* ── WhatsApp API keys (multi provider: FONNTE | CLOUD | WAHA) ────── */

export const waApiKeys = pgTable(
  "wa_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 16 }).notNull(), // FONNTE | CLOUD | WAHA
    label: varchar("label", { length: 80 }).notNull(),
    token: varchar("token", { length: 500 }).notNull(),
    phoneId: varchar("phone_id", { length: 40 }),
    note: varchar("note", { length: 160 }),
    isActive: boolean("is_active").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("wa_keys_provider_idx").on(t.provider)]
);

/* ── Alarm WhatsApp terjadwal (rules + log) ───────────────────────── */

export const waAlertRules = pgTable(
  "wa_alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull().unique(), // ABSENSI_BELUM_LAPOR / SCORECARD_TAK_TERCAPAI / SCORECARD_BELUM_ISI / FOLLOWUP_TERLAMBAT / STOK_MINIM
    enabled: boolean("enabled").notNull().default(false),
    sendHour: integer("send_hour").notNull().default(20),
    sendMinute: integer("send_minute").notNull().default(0),
    phonesCsv: text("phones_csv"),
    includeAffected: boolean("include_affected").notNull().default(false),
    targetRoles: text("target_roles").notNull().default("SUPERADM"),
    onlyWeekdays: boolean("only_weekdays").notNull().default(false),
    template: text("template"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("wa_alert_rules_code_uidx").on(t.code)]
);

export const waAlertsLog = pgTable(
  "wa_alerts_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleCode: varchar("rule_code", { length: 32 }).notNull(),
    recipients: text("recipients"),
    message: text("message"),
    status: varchar("status", { length: 16 }).notNull().default("SENT"),
    error: varchar("error", { length: 240 }),
    ...timestamps,
  },
  (t) => [index("wa_log_rule_idx").on(t.ruleCode)]
);

/* ── Tugas dapur otomatis (BOM) dari paket/produk saat order dikonfirmasi ── */

export const kitchenTasks = pgTable(
  "kitchen_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    status: varchar("status", { length: 16 }).notNull().default("MENUNGGU"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: uuid("done_by"),
    ...timestamps,
  },
  (t) => [index("kitchen_tasks_order_idx").on(t.orderId), index("kitchen_tasks_status_idx").on(t.status)]
);

/* ── Penutupan periode akuntansi (blokir posting manual periode tertutup) ─── */

export const periodClosings = pgTable("period_closings", {
  id: uuid("id").primaryKey().defaultRandom(),
  period: varchar("period", { length: 7 }).notNull().unique(),
  note: text("note"),
  closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

/* ── Saldu awal per cabang (neraca per cabang) ─────────────────────────── */

export const accountOpenings = pgTable(
  "account_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    opening: bigint("opening", { mode: "bigint" }).notNull().default(sql`0`),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("account_openings_branch_account_uidx").on(t.branchId, t.accountId)]
);
