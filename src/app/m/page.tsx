import Link from "next/link";
import Image from "next/image";
import { and, eq, gte, lte, sql, asc, inArray } from "drizzle-orm";
import { sql as sqlRaw } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { deliveryTasks, inventoryItems, productionBatches } from "@/db/schema/erp-extensions";
import { requirePageUser } from "@/lib/server/page-auth";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

function startToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function MobileDashboard() {
  const user = await requirePageUser();
  const branchId = user.branchId ?? null;
  const t0 = startToday();
  const t1 = endToday();
  const branchCond = branchId ? eq(orders.branchId, branchId) : undefined;

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      omzet: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
    })
    .from(orders)
    .where(branchCond ? and(gte(orders.createdAt, t0), lte(orders.createdAt, t1), branchCond) : undefined)
    // no_operational order for delivery tasks list
    .offset(0);

  void sqlRaw;

  const batchToday = await db
    .select({ stage: productionBatches.stage, c: sql<number>`count(*)::int` })
    .from(productionBatches)
    .where(branchId ? eq(productionBatches.branchId, branchId) : undefined)
    .groupBy(productionBatches.stage);

  const stageDone = batchToday
    .filter((b) => ["SLAUGHTERED", "MASAK", "PACKING", "QC", "SIAP"].includes(b.stage))
    .reduce((a, b) => a + b.c, 0);
  const stageRPH = batchToday.filter((b) => b.stage === "RPH").reduce((a, b) => a + b.c, 0);

  const armada = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(deliveryTasks)
    .where(
      branchId
        ? and(
            eq(deliveryTasks.branchId, branchId),
            inArray(deliveryTasks.status, ["WAITING", "IN_TRANSIT"])
          )
        : undefined
    );

  const deliveriesToday = await db
    .select()
    .from(deliveryTasks)
    .where(
      and(
        branchId ? eq(deliveryTasks.branchId, branchId) : undefined,
        gte(deliveryTasks.scheduledAt, t0),
        lte(deliveryTasks.scheduledAt, t1)
      )
    )
    .orderBy(asc(deliveryTasks.scheduledAt))
    .limit(3);

  const stokKritis = await db
    .select({ name: inventoryItems.name, qty: inventoryItems.qty, min: inventoryItems.minQty, unit: inventoryItems.unit })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.isActive, true), lte(inventoryItems.qty, inventoryItems.minQty)))
    .orderBy(asc(inventoryItems.qty))
    .limit(3);


  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[#eef2ff] px-3 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Omzet bulan ini</p>
            <p className="mt-1 text-[20px] font-bold text-primary">Rp {formatIDR(BigInt(String(agg?.omzet ?? "0")))}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{agg?.total ?? 0} order tercatat</p>
          </div>
          <div className="rounded-xl bg-[#fff7ed] px-3 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Sembelihan sisa</p>
            <p className="mt-1 text-[20px] font-bold text-[#b45309]">{stageRPH} ekor</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{stageDone} batch sudah diproses</p>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-slate-500">Armada aktif</p>
            <p className="mt-1 text-[18px] font-bold text-primary">{armada[0]?.c ?? 0} kurir</p>
          </div>
          <div className="rounded-xl border border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-slate-500">Pengiriman hari ini</p>
            <p className="mt-1 text-[18px] font-bold text-gold-strong">{deliveriesToday.length} tugas</p>
          </div>
        </div>
      </div>

      {stokKritis.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-3.5 py-3">
          <p className="text-[12px] font-bold text-amber-700">Peringatan Stok Kritis</p>
          <ul className="mt-1.5 space-y-1">
            {stokKritis.map((s) => (
              <li key={s.name} className="text-[12.5px] text-amber-900">
                {s.qty}/{s.min} {s.unit} — {s.name}
              </li>
            ))}
          </ul>
          <Link href="/inventory" className="mt-2 inline-block text-[11px] font-semibold text-primary hover:underline">
            Kelola stok →
          </Link>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[14px] font-bold text-slate-800">Jadwal pengiriman hari ini</p>
          <Link href="/delivery" className="text-[11px] font-semibold text-primary hover:underline">
            Semua →
          </Link>
        </div>
        <div className="space-y-2.5">
          {deliveriesToday.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-4 text-[12px] text-slate-500">
              Tidak ada pengiriman terjadwal hari ini.
            </div>
          )}
          {deliveriesToday.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{t.destination}</p>
                  <p className="text-[11px] text-slate-500">{t.contactName ?? "—"} · {t.contactPhone ?? ""}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    t.status === "ARRIVED"
                      ? "bg-emerald-100 text-emerald-700"
                      : t.status === "IN_TRANSIT"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              {t.notes ? <p className="mt-1 text-[11px] text-slate-400">{t.notes}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
        <Link href="/orders/new" className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-bold text-white">
          <Image src="/img/logo-madani.jpg" alt="" width={20} height={20} className="rounded" />
          + Intake Pesanan
        </Link>
        <Link href="/production" className="flex items-center gap-2 rounded-xl border border-gold px-3.5 py-2 text-[12px] font-bold text-gold-strong">
          RPH Syar&apos;i
        </Link>
      </div>
    </div>
  );
}
