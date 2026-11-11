import "server-only";
import { assertBranchAccess } from "@/lib/branch-access";
import { can } from "@/lib/permissions";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { packageItems, packages, priceVersions, productCategories, products, productVariants } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { insertAudit } from "@/lib/server/audit";
import type { AuthUser } from "@/lib/server/auth";
import { packageCreateSchema, productCreateSchema, type LineItemInput, type PackageCreateInput, type ProductCreateInput } from "@/server/schemas";

export async function createProduct(input: ProductCreateInput, actor: AuthUser): Promise<string> {
  const parsed = productCreateSchema.parse(input);
  const exists = await db.select({ id: products.id }).from(products).where(eq(products.code, parsed.code)).limit(1);
  if (exists.length > 0) throw new ConflictError(`Kode produk sudah dipakai: ${parsed.code}`);

  const [row] = await db
    .insert(products)
    .values({
      branchId: parsed.branchId ?? null,
      code: parsed.code,
      categoryId: parsed.categoryId ?? null,
      name: parsed.name,
      type: parsed.type,
      unit: parsed.unit,
      unitWeightGr: parsed.unitWeightGr ?? null,
      salePrice: parsed.salePrice,
      hppBasis: parsed.hppBasis,
      description: parsed.description ?? null,
    })
    .returning({ id: products.id, name: products.name });

  await db.insert(priceVersions).values({
    entityType: "PRODUCT",
    entityId: row.id,
    price: parsed.salePrice,
    createdBy: actor.id,
  });

  await insertAudit(db, { actor, action: "CREATE", module: "products", entityType: "product", entityId: row.id, after: { ...row } });
  return row.id;
}

export async function createPackage(input: PackageCreateInput, actor: AuthUser): Promise<string> {
  const parsed = packageCreateSchema.parse(input);
  const exists = await db.select({ id: packages.id }).from(packages).where(eq(packages.code, parsed.code)).limit(1);
  if (exists.length > 0) throw new ConflictError(`Kode paket sudah dipakai: ${parsed.code}`);

  let itemsTotal = 0n;
  for (const item of parsed.items) {
    if (item.isFree) continue;
    itemsTotal += item.unitPrice * BigInt(item.quantity);
  }

  const [row] = await db
    .insert(packages)
    .values({
      branchId: parsed.branchId ?? null,
      code: parsed.code,
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description ?? null,
      discountBps: parsed.discountBps,
    })
    .returning({ id: packages.id, name: packages.name });

  for (const item of parsed.items) {
    await db.insert(packageItems).values({
      packageId: row.id,
      productId: item.kind === "PRODUK" ? item.entityId ?? null : null,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      unitPrice: item.isFree ? null : item.unitPrice,
      isFree: item.isFree,
    });
  }

  await db.insert(priceVersions).values({
    entityType: "PACKAGE",
    entityId: row.id,
    price: itemsTotal,
    discountBps: parsed.discountBps,
    note: "Dibuat dari komposisi paket",
    createdBy: actor.id,
  });

  await insertAudit(db, { actor, action: "CREATE", module: "products", entityType: "package", entityId: row.id, after: { ...row } });
  return row.id;
}

export async function updateProductPrice(productId: string, salePrice: bigint, actor: AuthUser, note?: string): Promise<void> {
  const row = await db.update(products).set({ salePrice }).where(eq(products.id, productId)).returning({ id: products.id });
  if (row.length === 0) throw new NotFoundError("Produk tidak ditemukan.");
  await db.insert(priceVersions).values({
    entityType: "PRODUCT",
    entityId: productId,
    price: salePrice,
    note: note ?? "Update harga",
    createdBy: actor.id,
  });
  await insertAudit(db, {
    actor,
    action: "UPDATE",
    module: "products",
    entityType: "product",
    entityId: productId,
    after: { salePrice: salePrice.toString() },
  });
}

export async function listProducts(opts: { activeOnly?: boolean; type?: "PRODUK_OLAH" | "PAKET" } = {}) {
  const conditions = [];
  if (opts.activeOnly) conditions.push(eq(products.isActive, true));
  if (opts.type) conditions.push(eq(products.type, opts.type));
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(products).where(where).orderBy(products.name);
}

export async function listPackages() {
  return db.select().from(packages).where(eq(packages.isActive, true)).orderBy(packages.name);
}

export async function getPackageDetail(id: string) {
  const pkg = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  if (pkg.length === 0) throw new NotFoundError("Paket tidak ditemukan.");
  const items = await db.select().from(packageItems).where(eq(packageItems.packageId, id));
  return { package: pkg[0], items };
}

export async function listCategories() {
  return db.select().from(productCategories).orderBy(productCategories.name);
}

export interface PriceSnapshot {
  snapshot: unknown;
  description: string;
  unitPrice: bigint;
}

/** Snapshot harga saat dokumen dibuat — nilai dibekukan di baris dokumen. */
export async function snapshotPrices(lines: LineItemInput[], actor?: AuthUser): Promise<PriceSnapshot[]> {
  if (actor && !can(actor.permissions, "products.pricing.update") && lines.some((line) => line.isFree || line.discountBps > 0)) throw new ForbiddenError("Perlu izin perubahan harga untuk diskon atau item gratis.");
  const out: PriceSnapshot[] = [];

  const pkgIds = lines.filter((l) => l.kind === "PAKET" && l.entityId).map((l) => l.entityId!);
  const prodIds = lines.filter((l) => l.kind === "PRODUK" && l.entityId).map((l) => l.entityId!);
  const variantIds = lines.filter((l) => l.variantId).map((l) => l.variantId!);

  const [pkgs, prods, variants] = await Promise.all([
    pkgIds.length ? db.select().from(packages).where(inArray(packages.id, pkgIds)) : Promise.resolve([]),
    prodIds.length ? db.select().from(products).where(inArray(products.id, prodIds)) : Promise.resolve([]),
    variantIds.length ? db.select().from(productVariants).where(inArray(productVariants.id, variantIds)) : Promise.resolve([]),
  ]);

  const pkgMap = new Map(pkgs.map((p) => [p.id, p]));
  const prodMap = new Map(prods.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (const line of lines) {
    switch (line.kind) {
      case "PAKET": {
        const pkg = line.entityId ? pkgMap.get(line.entityId) : undefined;
        if (!pkg || !pkg.isActive) throw new NotFoundError("Paket tidak tersedia.");
        if (actor && pkg.branchId) assertBranchAccess(actor, pkg.branchId);
        const comp = await getPackageComputedTotal(pkg.id);
        if (pkg) {
          const discount = (comp * BigInt(pkg.discountBps)) / 10000n;
          out.push({
            snapshot: { packageId: pkg.id, name: pkg.name, comp, discountBps: pkg.discountBps },
            description: line.description || pkg.name,
            unitPrice: comp - discount,
          });
        } else {
          out.push({ snapshot: {}, description: line.description || "Paket", unitPrice: line.unitPrice });
        }
        break;
      }
      case "PRODUK": {
        const prod = line.entityId ? prodMap.get(line.entityId) : undefined;
        if (!prod || !prod.isActive) throw new NotFoundError("Produk tidak tersedia.");
        if (actor && prod.branchId) assertBranchAccess(actor, prod.branchId);
        const variant = line.variantId ? variantMap.get(line.variantId) : undefined;
        if (line.variantId && (!variant || variant.productId !== prod.id)) throw new NotFoundError("Varian produk tidak tersedia.");
        const base = prod?.salePrice ?? 0n;
        const delta = variant?.priceDelta ?? 0n;
        out.push({
          snapshot: { productId: prod?.id, variantId: variant?.id },
          description: line.description || (variant ? `${prod?.name} · ${variant.name}` : prod?.name) || "Produk",
          unitPrice: (actor && can(actor.permissions, "products.pricing.update") && line.unitPrice > 0n ? line.unitPrice : base + delta),
        });
        break;
      }
      case "ANIMAL":
      case "SERVICE": {
        out.push({
          snapshot: { kind: line.kind, entityId: line.entityId },
          description: line.description || (line.kind === "ANIMAL" ? "Hewan Aqiqah" : "Jasa"),
          unitPrice: line.unitPrice,
        });
        break;
      }
      default: {
        out.push({ snapshot: {}, description: line.description, unitPrice: line.unitPrice });
      }
    }
  }
  return out;
}

/** Jumlah harga komponen paket (sebelum diskon paket). */
export async function getPackageComputedTotal(pkgId: string): Promise<bigint> {
  const items = await db.select().from(packageItems).where(eq(packageItems.packageId, pkgId));
  let total = 0n;
  for (const it of items) {
    if (it.isFree) continue;
    const price = it.unitPrice ?? 0n;
    total += price * BigInt(it.quantity);
  }
  return total;
}