import { ActionForm } from "@/components/app/action-form";
import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { productionBatches } from "@/db/schema/erp-extensions";
import { customers } from "@/db/schema/crm";
import { orders } from "@/db/schema/sales";
import { requirePagePermission } from "@/lib/server/page-auth";
import { advanceProdStageFormAction, sendBatchWaVoidAction, setProdQcFormAction } from "@/server/actions/erp";
import { getWhatsappSettings } from "@/server/services/whatsapp";

export const dynamic = "force-dynamic";

const STAGES = ["RPH", "POTONG", "MASAK", "PACKING", "QC", "SIAP"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  RPH: "RPH",
  POTONG: "Potong",
  MASAK: "Masak",
  PACKING: "Packing",
  QC: "QC",
  SIAP: "Selesai",
};

const CHIPS: Array<{ k: string; label: string }> = [
  { k: "", label: "Aktif" },
  ...STAGES.map((s) => ({ k: s, label: STAGE_LABELS[s] })),
];

const STAGE_PAL: Record<string, string> = {
  RPH: "bg-amber-50 text-amber-700 border-amber-200",
  POTONG: "bg-orange-50 text-orange-700 border-orange-200",
  MASAK: "bg-violet-50 text-violet-700 border-violet-200",
  PACKING: "bg-cyan-50 text-cyan-700 border-cyan-200",
  QC: "bg-blue-50 text-blue-700 border-blue-200",
  SIAP: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default async function MobileRph({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const user = await requirePagePermission("production.batches.view");
  const branchId = user.branchId ?? null;
  const sp = await searchParams;
  const chip = CHIPS.find((c) => c.k === (sp.stage ?? "")) ?? CHIPS[0];

  const cond =
    chip.k === "SIAP"
      ? eq(productionBatches.stage, "SIAP")
      : chip.k
        ? eq(productionBatches.stage, chip.k as Stage)
        : ne(productionBatches.stage, "SIAP");

  const rows = await db
    .select({
      id: productionBatches.id,
      batchNumber: productionBatches.batchNumber,
      itemName: productionBatches.itemName,
      qtyPlanned: productionBatches.qtyPlanned,
      qtyDone: productionBatches.qtyDone,
      waste: productionBatches.waste,
      stage: productionBatches.stage,
      qcStatus: productionBatches.qcStatus,
      notes: productionBatches.notes,
      createdAt: productionBatches.createdAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      shohibulName: orders.shohibulName,
      childName: orders.childName,
      customerName: customers.name,
    })
    .from(productionBatches)
    .leftJoin(orders, eq(productionBatches.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(branchId ? eq(productionBatches.branchId, branchId) : undefined, cond))
    .orderBy(desc(productionBatches.createdAt))
    .limit(60);

  const counts = await db
    .select({ stage: productionBatches.stage, c: sql<number>`count(*)::int` })
    .from(productionBatches)
    .where(branchId ? eq(productionBatches.branchId, branchId) : undefined)
    .groupBy(productionBatches.stage);
  const countOf = (s: string) => counts.find((c) => c.stage === s)?.c ?? 0;

  const wa = await getWhatsappSettings().catch(() => null);
  const waReady = Boolean(wa?.enabled);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
        <p className="text-[13px] font-bold text-slate-800">RPH Syar&apos;i — tahapan produksi</p>
        <p className="text-[11px] text-slate-500">
          {countOf("RPH")} tahap RPH · {STAGES.filter((s) => s !== "RPH" && s !== "SIAP").reduce((a, s) => a + countOf(s), 0)} dalam proses ·{" "}
          {countOf("SIAP")} siap antar
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CHIPS.map((c) => {
          const active = c.k === chip.k;
          return (
            <Link
              key={c.k || "all"}
              href={c.k ? `/m/rph?stage=${c.k}` : "/m/rph"}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold ${
                active ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-6 text-center text-[12.5px] text-slate-500">
            Belum ada batch pada tahap ini.
          </div>
        )}
        {rows.map((b) => {
          const idx = STAGES.indexOf(b.stage as Stage);
          const isDone = b.stage === "SIAP";
          const label = STAGE_LABELS[b.stage as Stage] ?? b.stage;
          const shohibul = b.shohibulName ?? b.customerName ?? null;
          return (
            <div key={b.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-data text-[11px] text-slate-500">{b.batchNumber}</p>
                  <p className="truncate text-[15px] font-bold text-slate-900">{b.itemName}</p>
                  <p className="text-[11.5px] text-slate-500">
                    {b.qtyPlanned > 0 && `Qty ${b.qtyPlanned}`} {b.waste > 0 ? `· sisa ${b.qtyDone}${b.waste ? ` (buang ${b.waste})` : ""}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${STAGE_PAL[b.stage] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
                    {label}
                  </span>
                  <div className="mt-1 flex justify-end gap-0.5" aria-hidden>
                    {STAGES.map((s, i) => (
                      <span key={s} className={`h-1.5 w-4 rounded-full ${i <= idx ? "bg-primary" : "bg-slate-200"}`} style={{ opacity: i <= idx ? 1 : 0.5 }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-0.5">
                {b.orderNumber ? (
                  <Link href={`/orders/${b.orderId}`} className="font-data text-[11px] text-primary underline-offset-2 hover:underline">
                    #{b.orderNumber}
                    {shohibul ? ` · ${shohibul}` : ""}
                    {b.childName ? ` — anak ${b.childName}` : ""}
                  </Link>
                ) : (
                  <p className="text-[11px] italic text-slate-400">Batch manual tanpa pesanan</p>
                )}
                {b.notes && <p className="text-[11px] text-slate-400">{b.notes}</p>}
              </div>

              {!isDone && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ActionForm action={advanceProdStageFormAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" disabled={b.stage === "QC" && b.qcStatus !== "PASS"} className="rounded-xl bg-primary px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50">
                      Lanjut → {STAGE_LABELS[STAGES[idx + 1]] ?? ""}
                    </button>
                  </ActionForm>
                  {b.stage === "QC" && <>
                  <ActionForm action={setProdQcFormAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="qc" value="PASS" />
                    <button type="submit" className={`rounded-xl border px-3 py-2 text-[12px] font-bold ${b.qcStatus === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>
                      QC Pass
                    </button>
                  </ActionForm>
                  <ActionForm action={setProdQcFormAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="qc" value="FAIL" />
                    <button type="submit" className={`rounded-xl border px-3 py-2 text-[12px] font-bold ${b.qcStatus === "FAIL" ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 text-slate-600"}`}>
                      QC Gagal
                    </button>
                  </ActionForm>
                  </>}
                </div>
              )}
              {isDone && b.qcStatus === "FAIL" && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-1.5 text-[11.5px] font-semibold text-red-600">QC gagal tercatat — cek fisik & perbaiki sebelum antar.</p>
              )}

              {waReady && b.orderNumber && (
                <details className="mt-2.5">
                  <summary className="cursor-pointer text-[11.5px] font-semibold text-gold-strong">Kirim WA shohibul</summary>
                  <ActionForm action={sendBatchWaVoidAction} className="mt-1.5 flex gap-1.5">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="link" placeholder="link bukti (opsional)" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-[12px] outline-none focus:border-primary" />
                    <button type="submit" className="rounded-xl bg-gold px-3 py-1.5 text-[12px] font-bold text-white">
                      Kirim
                    </button>
                  </ActionForm>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
