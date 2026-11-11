import { ActionForm } from "@/components/app/action-form";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { deliveryTasks } from "@/db/schema/erp-extensions";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime } from "@/lib/utils";
import PodForm from "@/components/mobile/pod-form";
import { setDeliveryStatusFormAction } from "@/server/actions/erp";

export const dynamic = "force-dynamic";

const STATUS_PAL: Record<string, string> = {
  WAITING: "bg-slate-100 text-slate-600 border-slate-200",
  IN_TRANSIT: "bg-orange-50 text-orange-700 border-orange-200",
  ARRIVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  GAGAL: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABEL: Record<string, string> = {
  WAITING: "MENUNGGU",
  IN_TRANSIT: "JALAN",
  ARRIVED: "TIBA",
  GAGAL: "GAGAL",
};

type TaskCard = {
  id: string;
  destination: string;
  contactName: string | null;
  contactPhone: string | null;
  driverName: string | null;
  scheduledAt: Date | null;
  status: string;
  deliveredAt: Date | null;
  notes: string | null;
  podRecipientName: string | null;
  podPhotoUrl: string | null;
  podSignatureUrl: string | null;
  podTempC: number | null;
  podGeo: string | null;
  podChecklist: string | null;
  podNotes: string | null;
  podAt: Date | null;
  orderNumber: string | null;
  childName: string | null;
  shohibulName: string | null;
  recipientPhone: string | null;
};

async function fetchTasks(cond: ReturnType<typeof and>): Promise<TaskCard[]> {
  const rows = await db
    .select({
      id: deliveryTasks.id,
      destination: deliveryTasks.destination,
      contactName: deliveryTasks.contactName,
      contactPhone: deliveryTasks.contactPhone,
      driverName: deliveryTasks.driverName,
      scheduledAt: deliveryTasks.scheduledAt,
      status: deliveryTasks.status,
      deliveredAt: deliveryTasks.deliveredAt,
      notes: deliveryTasks.notes,
      podRecipientName: deliveryTasks.podRecipientName,
      podPhotoUrl: deliveryTasks.podPhotoUrl,
      podSignatureUrl: deliveryTasks.podSignatureUrl,
      podTempC: deliveryTasks.podTempC,
      podGeo: deliveryTasks.podGeo,
      podChecklist: deliveryTasks.podChecklist,
      podNotes: deliveryTasks.podNotes,
      podAt: deliveryTasks.podAt,
      orderNumber: orders.orderNumber,
      childName: orders.childName,
      shohibulName: orders.shohibulName,
      recipientPhone: orders.recipientPhone,
    })
    .from(deliveryTasks)
    .leftJoin(orders, eq(deliveryTasks.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(cond)
    .orderBy(sql`${deliveryTasks.scheduledAt} asc nulls last`)
    .limit(30);
  return rows;
}

function Chip({ s }: { s: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${STATUS_PAL[s] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

function TaskHead({ t }: { t: TaskCard }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">{t.destination}</p>
        <p className="text-[11.5px] text-slate-500">
          {t.contactName ?? "—"}
          {t.contactPhone ? ` · ${t.contactPhone}` : ""}
        </p>
        {t.orderNumber && (
          <p className="font-data text-[11px] text-primary">
            #{t.orderNumber}
            {t.childName ? ` — anak ${t.childName}` : ""}
          </p>
        )}
      </div>
      <Chip s={t.status} />
    </div>
  );
}

function TaskMeta({ t }: { t: TaskCard }) {
  return (
    <p className="font-data text-[11px] text-slate-500">
      Jadwal {t.scheduledAt ? formatDateTime(t.scheduledAt) : "-"} {t.driverName ? `· kurir ${t.driverName}` : ""}
    </p>
  );
}

export default async function MobileKurir() {
  const user = await requirePagePermission("delivery.deliveries.view");
  const branchId = user.branchId ?? null;

  const queue = await fetchTasks(
    and(branchId ? eq(deliveryTasks.branchId, branchId) : undefined, inArray(deliveryTasks.status, ["WAITING", "IN_TRANSIT"]))
  );
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const done = await fetchTasks(
    and(
      branchId ? eq(deliveryTasks.branchId, branchId) : undefined,
      inArray(deliveryTasks.status, ["ARRIVED", "GAGAL"]),
      gte(sql`coalesce(${deliveryTasks.podAt}, ${deliveryTasks.deliveredAt})`, t0)
    )
  ).catch(() => [] as TaskCard[]);
  done.sort((a, b) => (b.podAt ?? b.deliveredAt ?? new Date()).getTime() - (a.podAt ?? a.deliveredAt ?? new Date()).getTime());

  const berjalan = queue.filter((t) => t.status === "IN_TRANSIT");
  const menunggu = queue.filter((t) => t.status === "WAITING");

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
        <p className="text-[13px] font-bold text-slate-800">Kurir POD — antaran hari ini</p>
        <p className="text-[11px] text-slate-500">
          {berjalan.length} berjalan · {menunggu.length} menunggu · {done.length} selesai hari ini
        </p>
      </div>

      {queue.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-6 text-center text-[12.5px] text-slate-500">
          Tidak ada tugas antaran aktif.
        </div>
      )}

      {berjalan.map((t) => (
        <div key={t.id} className="rounded-2xl border-2 border-gold bg-white px-4 py-3.5 shadow-sm">
          <TaskHead t={t} />
          <div className="mt-1.5">
            <TaskMeta t={t} />
            {t.notes && <p className="mt-0.5 text-[11px] text-slate-400">{t.notes}</p>}
          </div>
          <details className="mt-2.5">
            <summary className="cursor-pointer rounded-xl bg-primary px-3.5 py-2 text-center text-[12.5px] font-bold text-white">Sampai — isi POD</summary>
            <div className="pt-3">
              <PodForm taskId={t.id} destination={t.destination} contactName={t.contactName} />
            </div>
          </details>
          <ActionForm action={setDeliveryStatusFormAction} className="mt-2 text-center">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="status" value="ARRIVED" />
            <button type="submit" className="text-[11px] font-semibold text-slate-400 underline">
              tandai tiba tanpa POD
            </button>
          </ActionForm>
        </div>
      ))}

      {menunggu.map((t) => (
        <div key={t.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
          <TaskHead t={t} />
          <div className="mt-1.5">
            <TaskMeta t={t} />
            {t.notes && <p className="mt-0.5 text-[11px] text-slate-400">{t.notes}</p>}
          </div>
          <ActionForm action={setDeliveryStatusFormAction} className="mt-3">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="status" value="IN_TRANSIT" />
            <button type="submit" className="w-full rounded-xl bg-primary px-3 py-2 text-[12.5px] font-bold text-white">
              Berangkat antar
            </button>
          </ActionForm>
        </div>
      ))}

      {done.length > 0 && (
        <div>
          <p className="mb-1.5 mt-3 text-[12.5px] font-bold text-slate-700">Selesai hari ini</p>
          <div className="space-y-2.5">
            {done.slice(0, 8).map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <TaskHead t={t} />
                <div className="mt-1.5 space-y-0.5">
                  <p className="font-data text-[11px] text-slate-500">
                    Tiba {formatDateTime(t.podAt ?? t.deliveredAt)} {t.podRecipientName ? `· diterima ${t.podRecipientName}` : ""}
                    {t.podTempC != null ? ` · suhu ${t.podTempC}°C` : ""}
                  </p>
                  {t.podGeo && <p className="text-[10px] text-slate-400">GPS {t.podGeo}</p>}
                  {t.podChecklist && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {t.podChecklist.split(",").map((c, i) => (
                        <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                          {c.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  {t.podNotes && <p className="text-[11px] text-slate-400">{t.podNotes}</p>}
                  <div className="flex gap-2 pt-1">
                    {t.podPhotoUrl && (
                      <a href={`/storage/${t.podPhotoUrl}`} target="_blank" className="text-[11px] font-semibold text-primary underline">
                        foto bukti
                      </a>
                    )}
                    {t.podSignatureUrl && (
                      <a href={`/storage/${t.podSignatureUrl}`} target="_blank" className="text-[11px] font-semibold text-primary underline">
                        tanda tangan
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
