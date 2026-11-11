import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, timestamps } from "./core";
import { orders } from "./sales";

export const supplierType = pgEnum("supplier_type", ["HEWAN", "BAHAN", "JASA", "LAIN"]);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    type: supplierType("type").notNull().default("HEWAN"),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 80 }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("suppliers_name_idx").on(t.name)]
);

export const animalSpecies = pgEnum("animal_species", ["KAMBING", "SAPI"]);
export const animalStatus = pgEnum("animal_status", [
  "AVAILABLE",
  "RESERVED",
  "SLAUGHTERED",
  "ISSUED",
  "LOSS",
]);

/** Hewan ternak — dipakai order (registrasi produksi ada di Phase 3+). */
export const animals = pgTable(
  "animals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    species: animalSpecies("species").notNull(),
    breed: varchar("breed", { length: 120 }),
    weightKg: text("weight_kg"),
    ageMonths: text("age_months"),
    tagNumber: varchar("tag_number", { length: 40 }),
    gender: varchar("gender", { length: 8 }),
    status: animalStatus("status").notNull().default("AVAILABLE"),
    purchasePrice: bigint("purchase_price", { mode: "bigint" }).notNull().default(sql`0`),
    pen: varchar("pen", { length: 80 }),
    skkhNumber: varchar("skkh_number", { length: 80 }),
    skkhFileUrl: text("skkh_file_url"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("animals_status_idx").on(t.status), index("animals_species_idx").on(t.species)]
);

export const deliveryStatus = pgEnum("delivery_status", [
  "WAITING",
  "PICKED",
  "IN_TRANSIT",
  "ARRIVED",
  "COMPLETE",
  "GAGAL",
]);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    deliveryNumber: varchar("delivery_number", { length: 32 }).notNull().unique(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    status: deliveryStatus("status").notNull().default("WAITING"),
    scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
    scheduledTimeSlot: varchar("scheduled_time_slot", { length: 40 }),
    driverName: varchar("driver_name", { length: 160 }),
    driverPhone: varchar("driver_phone", { length: 32 }),
    helperName: varchar("helper_name", { length: 160 }),
    vehicleInfo: text("vehicle_info"),
    itemsSummary: jsonb("items_summary"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    etaMinutes: integer("eta_minutes"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("deliveries_branch_status_idx").on(t.branchId, t.status),
    index("deliveries_order_idx").on(t.orderId),
  ]
);

export const deliveryPods = pgTable(
  "delivery_pods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    photoUrl: text("photo_url"),
    signatureUrl: text("signature_url"),
    gpsCoordinates: varchar("gps_coordinates", { length: 80 }),
    notes: text("notes"),
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedBy: uuid("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pods_delivery_idx").on(t.deliveryId)]
);