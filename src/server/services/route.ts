import { insertAudit } from "@/lib/server/audit";
import "server-only";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { deliveryTasks } from "@/db/schema/erp-extensions";
import { orders } from "@/db/schema/sales";

export interface RouteStop {
  taskId: string;
  orderId: string | null;
  destination: string;
  district: string | null;
  contactName: string | null;
  contactPhone: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  scheduledAt: Date | null;
  status: string;
  lat: number | null;
  lng: number | null;
}

function parseLatLng(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Titik pengiriman hari ini (WIB) yang belum tiba — dilengkapi koordinat gps order. */


/** Hapus tugas kiriman (bulk). Yang sudah tiba/berisi POD tidak boleh dihapus. */
export async function deleteDeliveryTasks(ids: string[], actor: import("@/lib/server/auth").AuthUser): Promise<{ error?: string }> {
  const rows = await db.select().from(deliveryTasks).where(inArray(deliveryTasks.id, ids));
  const done = rows.filter((r) => r.status === "ARRIVED" || r.deliveredAt);
  if (done.length > 0) {
    return { error: "Tugas yang sudah tiba/berbukti POD tidak boleh dihapus (arsip akuntansi)." };
  }
  for (const r of rows) {
    await db.delete(deliveryTasks).where(eq(deliveryTasks.id, r.id));
    await insertAudit(db, { actor, action: "DELETE", module: "delivery", entityType: "delivery_task", entityId: r.id, before: r });
  }
  return {};
}

export async function listRouteStops(branchId?: string | null): Promise<RouteStop[]> {
  const now = new Date();
  const jakKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
  const from = new Date(`${jakKey}T00:00:00+07:00`);
  const to = new Date(`${jakKey}T23:59:59+07:00`);

  const rows = await db
    .select({
      taskId: deliveryTasks.id,
      orderId: deliveryTasks.orderId,
      destination: deliveryTasks.destination,
      contactName: deliveryTasks.contactName,
      contactPhone: deliveryTasks.contactPhone,
      driverName: deliveryTasks.driverName,
      vehiclePlate: deliveryTasks.vehiclePlate,
      scheduledAt: deliveryTasks.scheduledAt,
      status: deliveryTasks.status,
      district: orders.deliveryDistrict,
      gpsRaw: orders.gpsCoordinates,
    })
    .from(deliveryTasks)
    .leftJoin(orders, eq(deliveryTasks.orderId, orders.id))
    .where(
      and(
        branchId ? eq(deliveryTasks.branchId, branchId) : undefined,
        gte(deliveryTasks.scheduledAt, from),
        lt(deliveryTasks.scheduledAt, new Date(to.getTime() + 1)),
        inArray(deliveryTasks.status, ["WAITING", "PICKED", "IN_TRANSIT"] as (typeof deliveryTasks.$inferSelect)["status"][])
      )
    )
    .orderBy(orders.deliveryDistrict, deliveryTasks.scheduledAt);

  return rows.map((r) => {
    const parsed = parseLatLng(r.gpsRaw ?? null);
    return {
      taskId: r.taskId,
      orderId: r.orderId,
      destination: r.destination,
      district: r.district,
      contactName: r.contactName,
      contactPhone: r.contactPhone,
      driverName: r.driverName,
      vehiclePlate: r.vehiclePlate,
      scheduledAt: r.scheduledAt,
      status: r.status,
      lat: parsed ? parsed.lat : null,
      lng: parsed ? parsed.lng : null,
    };
  });
}
