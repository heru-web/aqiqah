import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BUCKET_LINKS: Array<{ k: string; label: string; statuses: string[] }> = [
  { k: "all", label: "Semua", statuses: [] },
  { k: "confirmed", label: "Dikonfirmasi", statuses: ["ORDER_CONFIRMED"] },
  { k: "slaughtered", label: "Disembelih", statuses: ["SLAUGHTERED"] },
  { k: "cooked", label: "Dimasak", statuses: ["KITCHEN_COOKED"] },
  { k: "packed", label: "Packing", statuses: ["PACKED", "QC_READY"] },
  { k: "delivered", label: "Diantar", statuses: ["READY_DISPATCH", "DELIVERED", "COMPLETED"] },
];

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  ORDER_CONFIRMED: 1,
  ANIMALS_SIAAP: 1,
  SLAUGHTERED: 2,
  KITCHEN_COOKED: 3,
  PACKED: 4,
  QC_READY: 4,
  READY_DISPATCH: 5,
  DELIVERED: 6,
  COMPLETED: 7,
  CANCELLED: 0,
  REVERSED: 0,
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "DRAFT",
  ORDER_CONFIRMED: "CONFIRMED",
  ANIMALS_SIAAP: "SIAP RPH",
  SLAUGHTERED: "SLAUGHTERED",
  KITCHEN_COOKED: "COOKED",
  PACKED: "PACKED",
  QC_READY: "QC READY",
  READY_DISPATCH: "SIAP DIKIRIM",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
};

const STATUS_PAL: Record<string, string> = {
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  SLAUGHTERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COOKED: "bg-amber-50 text-amber-700 border-amber-200",
  PACKED: "bg-violet-50 text-violet-700 border-violet-200",
  "QC READY": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "SIAP DIKIRIM": "bg-orange-50 text-orange-700 border-orange-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
};

export default async function MobilePesanan({ searchParams }: { searchParams: Promise<{ bucket?: string; q?: string }> }) {
  const user = await requirePagePermission("orders.orders.view");
  const branchId = user.branchId ?? null;
  const sp = await searchParams;
  const bucket = sp.bucket ?? "all";
  const q = (sp.q ?? "").trim();
  const b = BUCKET_LINKS.find((x) => x.k === bucket) ?? BUCKET_LINKS[0];

  const where = and(
    ...(branchId ? [eq(orders.branchId, branchId)] : []),
    ...(q ? [or(ilike(orders.orderNumber, `%${q}%`), ilike(orders.shohibulName, `%${q}%`), ilike(orders.childName, `%${q}%`))] : []),
    ...(b.statuses.length > 0
      ? [
          sql`(${orders.status} in (${sql.join(
            b.statuses.map((s) => sql`${s}`),
            sql`, `
          )}))`,
        ]
      : [])
  );

  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(40);

  function StatusChip({ s }: { s: string }) {
    const label = STATUS_LABELS[s] ?? s;
    const cls = STATUS_PAL[label] ?? "bg-slate-100 text-slate-700 border-slate-200";
    const step = STATUS_ORDER[s] ?? 0;
    const pct = Math.max(8, Math.min(100, Math.round((step / 7) * 100)));
    return (
      <div>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${cls}`}>
          {label}
        </span>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="flex-[3] bg-primary" style={{ opacity: step >= 2 ? 1 : 0.3 }} />
          <div className="flex-[3] bg-gold" style={{ opacity: step >= 3 ? 1 : 0.3 }} />
          <div className="flex-[2] bg-violet-500" style={{ opacity: step >= 4 ? 1 : 0.3 }} />
          <div className="flex-[2] bg-cyan-500" style={{ opacity: step >= 5 ? 1 : 0.3 }} />
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500">{pct}% proses</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form action="/m/pesanan" method="GET" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari ID Pesanan, Shohibul, Anak…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
        />
        {b.k !== "all" && <input type="hidden" name="bucket" value={b.k} />}
        <button type="submit" className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
          Cari
        </button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {BUCKET_LINKS.map((b2) => {
          const active = b2.k === b.k;
          return (
            <Link
              key={b2.k}
              href={`/m/pesanan?bucket=${b2.k}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold ${
                active ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {b2.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-6 text-center text-[12.5px] text-slate-500">
            Belum ada pesanan pada filter ini.
          </div>
        )}
        {rows.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-data text-[11px] text-slate-500">#{o.orderNumber}</p>
                <p className="truncate text-[15px] font-bold text-slate-900">{o.shohibulName ?? "—"}</p>
              </div>
              <StatusChip s={o.status} />
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-[12px] text-slate-600">
                Anak: <span className="font-medium">{o.childName ?? "-"}</span>
              </p>
              <p className="font-data text-[11px] text-slate-500">
                Jadwal kirim: {o.deliveryDate ? new Date(o.deliveryDate).toISOString().slice(0, 10) : "-"} · slot {o.deliveryTimeSlot ?? "-"}
              </p>
            </div>
            <div className="mt-2 rounded-xl bg-[#eef2ff] px-3 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Total tagihan</p>
              <p className="text-[14px] font-bold text-primary">{formatIDR(o.total)}</p>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/orders/new"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-emerald-900/25 ring-2 ring-white"
        aria-label="Pesanan Baru"
      >
        <span className="text-[24px] font-bold leading-none">+</span>
      </Link>
    </div>
  );
}
