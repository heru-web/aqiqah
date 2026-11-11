import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { animals, auditLogs, suppliers, users } from "@/db/schema";
import type { AuthUser } from "@/lib/server/auth";
import {
  createAnimal,
  getAnimal,
  listAnimals,
  setAnimalStatus,
  updateAnimal,
} from "@/server/services/animals";
import {
  createSupplier,
  listSuppliers,
  setSupplierActive,
  updateSupplier,
} from "@/server/services/suppliers";

const created = { supplierId: "", animalId: "" };

async function adminActor(): Promise<AuthUser> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@madani-aqiqah.id").trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("admin user tidak ditemukan");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    branchId: null,
    roles: ["superadmin"],
    permissions: ["*"],
  };
}

afterAll(async () => {
  if (created.animalId) await db.delete(animals).where(eq(animals.id, created.animalId));
  if (created.supplierId) await db.delete(suppliers).where(eq(suppliers.id, created.supplierId));
  const ids = [created.animalId, created.supplierId].filter(Boolean);
  if (ids.length > 0) await db.delete(auditLogs).where(inArray(auditLogs.entityId, ids));
});

describe("Modul supplier & hewan (live DB)", () => {
  it("membuat supplier, hewan, lalu mengubah status herd", async () => {
    const actor = await adminActor();
    const suffix = Date.now().toString(36).toUpperCase();

    created.supplierId = await createSupplier(
      { name: `Supplier Uji ${suffix}`, type: "HEWAN", phone: "081200000000", city: "Yogyakarta" },
      actor
    );
    expect(created.supplierId).toBeTruthy();

    created.animalId = await createAnimal(
      {
        supplierId: created.supplierId,
        species: "KAMBING",
        breed: "Etawa",
        tagNumber: `UJI-${suffix}`,
        weightKg: "28",
        purchasePrice: 1_750_000n,
        purchasedAt: new Date("2026-01-05T00:00:00Z"),
      },
      actor
    );

    const rows = await listAnimals({ supplierId: created.supplierId });
    expect(rows).toHaveLength(1);
    expect(rows[0].tagNumber).toBe(`UJI-${suffix}`);
    expect(rows[0].supplierName).toContain("Supplier Uji");
    expect(rows[0].purchasePrice).toBe(1_750_000n);

    await setAnimalStatus(created.animalId, "RESERVED", actor);
    expect((await getAnimal(created.animalId))?.status).toBe("RESERVED");

    await updateAnimal(
      created.animalId,
      {
        supplierId: created.supplierId,
        species: "SAPI",
        tagNumber: `UJI-${suffix}`,
        status: "AVAILABLE",
        purchasePrice: 9_500_000n,
      },
      actor
    );
    const updated = await getAnimal(created.animalId);
    expect(updated?.species).toBe("SAPI");
    expect(updated?.status).toBe("AVAILABLE");
    expect(updated?.purchasePrice).toBe(9_500_000n);

    await updateSupplier(
      created.supplierId,
      { name: `Supplier Uji ${suffix}`, type: "HEWAN", city: "Sleman" },
      actor
    );
    await setSupplierActive(created.supplierId, false, actor);
    const inactive = await listSuppliers({ includeInactive: true });
    expect(inactive.find((s) => s.id === created.supplierId)?.isActive).toBe(false);
    const active = await listSuppliers();
    expect(active.some((s) => s.id === created.supplierId)).toBe(false);
  });
});
