/**
 * Seed demo (opsional): katalog produk/paket ala Stitch, pelanggan shohibul,
 * dan pipeline CRM. Data direkam langsung ke DB (bukan lewat service).
 *
 * Jalankan setelah `db:seed`: npm run db:seed:demo
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  leads,
  packages,
  packageItems,
  priceVersions,
  productCategories,
  products,
  users,
} from "@/db/schema";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id";

async function branchId(): Promise<string> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL.toLowerCase()))
    .limit(1);
  if (row.length === 0 || !row[0].branchId) {
    throw new Error(`Admin '${ADMIN_EMAIL}' belum ada. Jalankan npm run db:seed dulu.`);
  }
  return row[0].branchId;
}

async function ensureCategories(): Promise<Record<string, string>> {
  const defs: Array<[slug: string, name: string]> = [
    ["hewan-aqiqah", "Hewan Aqiqah"],
    ["daging-olahan", "Daging Olahan"],
    ["menu-aqiqah", "Menu Aqiqah"],
  ];
  const out: Record<string, string> = {};
  for (const [slug, name] of defs) {
    const existing = await db.select().from(productCategories).where(eq(productCategories.slug, slug)).limit(1);
    if (existing.length > 0) {
      out[slug] = existing[0].id;
      continue;
    }
    const [row] = await db.insert(productCategories).values({ slug, name }).returning({ id: productCategories.id });
    out[slug] = row.id;
  }
  return out;
}

interface ProductDef {
  code: string;
  name: string;
  unit: "EKOR" | "KG" | "BOX" | "PORSI" | "PAKET";
  salePrice: bigint;
  hppBasis: bigint;
  category: string;
  description?: string;
}

const PRODUCT_DEFS: ProductDef[] = [
  { code: "KMB-JTN", name: "Kambing Jantan (15-20 kg)", unit: "EKOR", salePrice: 3_250_000n, hppBasis: 2_750_000n, category: "hewan-aqiqah", description: "Kambing jantan sehat, bobot 15-20 kg." },
  { code: "KMB-BTN", name: "Kambing Betina", unit: "EKOR", salePrice: 2_750_000n, hppBasis: 2_350_000n, category: "hewan-aqiqah" },
  { code: "DOM-JTN", name: "Domba Jantan", unit: "EKOR", salePrice: 2_950_000n, hppBasis: 2_500_000n, category: "hewan-aqiqah" },
  { code: "SPI-EKR", name: "Sapi (1 Ekor)", unit: "EKOR", salePrice: 18_500_000n, hppBasis: 16_800_000n, category: "hewan-aqiqah" },
  { code: "OLH-RND", name: "Rendang Aqiqah 1 kg", unit: "BOX", salePrice: 165_000n, hppBasis: 120_000n, category: "daging-olahan" },
  { code: "OLH-GULE", name: "Gulai/Gule 1 kg", unit: "BOX", salePrice: 135_000n, hppBasis: 98_000n, category: "daging-olahan" },
  { code: "OLH-SATE", name: "Sate Aqiqah (60 tusuk)", unit: "BOX", salePrice: 95_000n, hppBasis: 72_000n, category: "daging-olahan" },
  { code: "OLH-SOP", name: "Sop Kambing 1 kg", unit: "BOX", salePrice: 120_000n, hppBasis: 88_000n, category: "daging-olahan" },
  { code: "OLH-BAKSO", name: "Bakso Aqiqah 1 kg", unit: "BOX", salePrice: 60_000n, hppBasis: 44_000n, category: "daging-olahan" },
  { code: "MN-NASBOX", name: "Nasi Box Roya (1 porsi)", unit: "PORSI", salePrice: 12_000n, hppBasis: 9_000n, category: "menu-aqiqah" },
];

async function ensureProducts(cats: Record<string, string>, bid: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of PRODUCT_DEFS) {
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.code, p.code))
      .limit(1);
    if (existing.length > 0) {
      out[p.code] = existing[0].id;
      continue;
    }
    const [row] = await db
      .insert(products)
      .values({
        branchId: bid,
        code: p.code,
        name: p.name,
        type: "PRODUK_OLAH",
        categoryId: cats[p.category],
        unit: p.unit,
        description: p.description ?? null,
        salePrice: p.salePrice,
        hppBasis: p.hppBasis,
        isActive: true,
      })
      .returning({ id: products.id });
    await db.insert(priceVersions).values({
      entityType: "PRODUCT",
      entityId: row.id,
      price: p.salePrice,
      discountBps: 0,
      note: "Seed demo",
      createdBy: null,
    });
    out[p.code] = row.id;
  }
  console.log(`  + Produk: ${PRODUCT_DEFS.length} item`);
  return out;
}

const PACKAGE_DEFS: Array<{ code: string; name: string; slug: string; discountBps: number; items: Array<{ productCode: string; quantity: number; isFree?: boolean }> }> = [
  {
    code: "PKG-SIL",
    name: "Paket Silver",
    slug: "paket-silver",
    discountBps: 0,
    items: [
      { productCode: "KMB-JTN", quantity: 1 },
      { productCode: "OLH-RND", quantity: 1 },
      { productCode: "OLH-GULE", quantity: 1 },
      { productCode: "OLH-SATE", quantity: 1 },
      { productCode: "OLH-SOP", quantity: 1 },
    ],
  },
  {
    code: "PKG-GOLD",
    name: "Paket Gold",
    slug: "paket-gold",
    discountBps: 500,
    items: [
      { productCode: "KMB-JTN", quantity: 1 },
      { productCode: "OLH-RND", quantity: 2 },
      { productCode: "OLH-GULE", quantity: 2 },
      { productCode: "OLH-SATE", quantity: 2 },
      { productCode: "OLH-SOP", quantity: 2 },
      { productCode: "OLH-BAKSO", quantity: 2 },
    ],
  },
  {
    code: "PKG-PLT",
    name: "Paket Platinum",
    slug: "paket-platinum",
    discountBps: 1000,
    items: [
      { productCode: "KMB-BTN", quantity: 1 },
      { productCode: "OLH-RND", quantity: 3 },
      { productCode: "OLH-GULE", quantity: 3 },
      { productCode: "OLH-SATE", quantity: 3 },
      { productCode: "OLH-SOP", quantity: 3 },
      { productCode: "OLH-BAKSO", quantity: 3 },
      { productCode: "MN-NASBOX", quantity: 60 },
    ],
  },
];

async function ensurePackages(prodById: Record<string, string>, bid: string): Promise<void> {
  for (const pkg of PACKAGE_DEFS) {
    const existing = await db.select().from(packages).where(eq(packages.code, pkg.code)).limit(1);
    if (existing.length > 0) continue;
    const [row] = await db
      .insert(packages)
      .values({
        branchId: bid,
        code: pkg.code,
        name: pkg.name,
        slug: pkg.slug,
        discountBps: pkg.discountBps,
        isActive: true,
      })
      .returning({ id: packages.id });
    for (const it of pkg.items) {
      const productId = prodById[it.productCode];
      const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      await db.insert(packageItems).values({
        packageId: row.id,
        productId,
        quantity: it.quantity,
        unitPrice: prod[0].salePrice,
        isFree: it.isFree ?? false,
      });
    }
  }
  console.log(`  + Paket: ${PACKAGE_DEFS.length} (Silver/Gold/Platinum)`);
}

const CUSTOMER_DEFS: Array<{ code: string; name: string; type: "PERUSAHAAN" | "PERORANGAN"; phone: string; city: string }> = [
  { code: "CST-2026-0001", name: "Bpk. Agus Santoso", type: "PERORANGAN", phone: "0812-2000-0101", city: "Bandung" },
  { code: "CST-2026-0002", name: "Ibu Rina Wijaya", type: "PERORANGAN", phone: "0813-2000-0202", city: "Bandung" },
  { code: "CST-2026-0003", name: "Bpk. Hendra Gunawan", type: "PERORANGAN", phone: "0821-2000-0303", city: "Cimahi" },
  { code: "CST-2026-0004", name: "Yayasan Al-Furqon", type: "PERUSAHAAN", phone: "022-2000-404", city: "Bandung" },
];

async function ensureCustomers(bid: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of CUSTOMER_DEFS) {
    const existing = await db.select().from(customers).where(eq(customers.code, c.code)).limit(1);
    if (existing.length > 0) {
      out[c.code] = existing[0].id;
      continue;
    }
    const [row] = await db
      .insert(customers)
      .values({
        branchId: bid,
        code: c.code,
        name: c.name,
        type: c.type,
        phone: c.phone,
        whatsapp: c.phone,
        city: c.city,
        isActive: true,
      })
      .returning({ id: customers.id });
    out[c.code] = row.id;
  }
  console.log(`  + Pelanggan: ${CUSTOMER_DEFS.length}`);
  return out;
}

async function ensureLeads(bid: string, adminId: string): Promise<void> {
  const defs: Array<{
    name: string;
    phone: string;
    source: "REFERRAL" | "ADS" | "SOCIAL" | "MARKETPLACE" | "WALK_IN" | "WEB" | "OTHER";
    status: "LEAD" | "CONTACTED" | "INTERESTED" | "QUOTATION" | "DP" | "CLOSED";
    budget: bigint;
    productInterest: string;
    city: string;
  }> = [
    { name: "Fajar Nugraha", phone: "0815-2000-0505", source: "WEB", status: "LEAD", budget: 3_000_000n, productInterest: "kambing", city: "Bandung" },
    { name: "Andi Saputra", phone: "0812-2000-0606", source: "SOCIAL", status: "CONTACTED", budget: 3_500_000n, productInterest: "paket", city: "Bandung" },
    { name: "Dedi Kurniawan", phone: "0813-2000-0707", source: "REFERRAL", status: "INTERESTED", budget: 2_800_000n, productInterest: "kambing", city: "Cimahi" },
    { name: "Bpk. Yusuf Rahman", phone: "0821-2000-0808", source: "ADS", status: "QUOTATION", budget: 15_500_000n, productInterest: "sapi", city: "Bandung" },
    { name: "Ibu Siti Nurjanah", phone: "0857-2000-0909", source: "WALK_IN", status: "DP", budget: 3_900_000n, productInterest: "paket", city: "Bandung" },
    { name: "Bpk. Ahmad Fauzi", phone: "0812-2000-1010", source: "REFERRAL", status: "QUOTATION", budget: 3_200_000n, productInterest: "kambing", city: "Cimahi" },
  ];
  const existing = await db.select().from(leads).limit(1);
  if (existing.length > 0) {
    console.log("  = Lead sudah ada, dilewati.");
    return;
  }
  for (const l of defs) {
    await db.insert(leads).values({
      branchId: bid,
      source: l.source,
      status: l.status,
      name: l.name,
      phone: l.phone,
      whatsapp: l.phone,
      city: l.city,
      productInterest: l.productInterest,
      budget: l.budget,
      assignedTo: adminId,
      createdBy: adminId,
      firstContactAt: l.status === "LEAD" ? null : new Date(),
      closedAt: l.status === "CLOSED" ? new Date() : null,
    });
  }
  console.log(`  + Lead: ${defs.length}`);
}

async function main(): Promise<void> {
  console.log("Seed demo Madani Aqiqah");
  const bid = await branchId();
  const admin = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL.toLowerCase())).limit(1);

  const cats = await ensureCategories();
  const prods = await ensureProducts(cats, bid);
  await ensurePackages(prods, bid);
  await ensureCustomers(bid);
  await ensureLeads(bid, admin[0].id);
  console.log("Selesai.");
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed demo gagal:", err);
    process.exit(1);
  });