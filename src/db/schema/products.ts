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
import { businessUnits } from "./performance";

export const productType = pgEnum("product_type", ["PRODUK_OLAH", "PAKET"]);
export const productUnit = pgEnum("product_unit", ["EKOR", "KG", "BOX", "PORSI", "PAKET"]);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    ...timestamps,
  },
  (t) => [index("pc_slug_uidx").on(t.slug)]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    code: varchar("code", { length: 40 }).notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    businessUnitId: uuid("business_unit_id").references(() => businessUnits.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    type: productType("type").notNull().default("PRODUK_OLAH"),
    description: text("description"),
    unit: productUnit("unit").notNull().default("PAKET"),
    unitWeightGr: integer("unit_weight_gr"),
    salePrice: bigint("sale_price", { mode: "bigint" }).notNull().default(sql`0`),
    hppBasis: bigint("hpp_basis", { mode: "bigint" }).notNull().default(sql`0`),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("products_branch_idx").on(t.branchId),
    index("products_code_uidx").on(t.branchId, t.code),
  ]
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    optionValues: text("option_values").notNull().default("{}"),
    priceDelta: bigint("price_delta", { mode: "bigint" }).notNull().default(sql`0`),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("variants_product_idx").on(t.productId)]
);

export const packages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchId: uuid("branch_id").references(() => branches.id),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    discountBps: integer("discount_bps").notNull().default(0), // basis point: 100 = 1%
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("packages_branch_idx").on(t.branchId)]
);

export const packageItems = pgTable(
  "package_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: bigint("unit_price", { mode: "bigint" }),
    isFree: boolean("is_free").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("package_items_pkg_idx").on(t.packageId)]
);

export const priceEntityType = pgEnum("price_entity_type", ["PRODUCT", "PACKAGE", "VARIANT"]);

/** Riwayat harga — immutable history untuk audit kalkulasi. */
export const priceVersions = pgTable(
  "price_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: priceEntityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    price: bigint("price", { mode: "bigint" }).notNull(),
    discountBps: integer("discount_bps").notNull().default(0),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("price_ver_entity_idx").on(t.entityType, t.entityId)]
);