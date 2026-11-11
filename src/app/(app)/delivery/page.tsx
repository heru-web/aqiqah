import { ActionForm } from "@/components/app/action-form";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { DeleteRowButton } from "@/components/app/table-extras";
import { deleteDeliveryTasksAction } from "@/server/actions/table-ops";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableExportButtons } from "@/components/app/table-export";
import { createDeliveryVoidAction, setDeliveryStatusFormAction } from "@/server/actions/erp";
import { listDeliveryTasks } from "@/server/services/erp";
import { listRouteStops } from "@/server/services/route";
import { optimizeStops } from "@/lib/route-optimizer";
import { requirePagePermission } from "@/lib/server/page-auth";
import { TrackingShareButton } from "@/components/system/tracking-share-button";
import { formatDateTime } from "@/lib/utils";
import { RouteIcon, TruckIcon } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  WAITING: "bersiap",
  IN_TRANSIT: "dikirim",
  ARRIVED: "sampai",
  GAGAL: "gagal",
};

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePagePermission("delivery.deliveries.view");
  const sp = await searchParams;
  const tasks = await listDeliveryTasks(user, sp.status);
  const stops = await listRouteStops(user.branchId ?? undefined);
  const routePlan = optimizeStops(stops.map((s) => ({ id: s.taskId, lat: s.lat, lng: s.lng })));
  const ordered = routePlan.order
    .map((id) => stops.find((s) => s.taskId === id))
    .filter((s): s is (typeof stops)[number] => Boolean(s))
    .sort((a, b) => Number(Boolean(a.scheduledAt) ? 0 : 1) - Number(Boolean(b.scheduledAt) ? 0 : 1));


  const rscColumns: RscColumn[] = [
    { key: "jadwal", header: "Jadwal" },
    { key: "tujuan", header: "Tujuan" },
    { key: "penerima", header: "Penerima" },
    { key: "pengemudi", header: "Pengemudi" },
    { key: "status", header: "Status" },
    { key: "pod", header: "POD" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = tasks.map((t) => ({
    id: t.id,
    cells: [
      <span className="text-xs text-muted-foreground" key="j">{t.scheduledAt ? formatDateTime(t.scheduledAt) : "—"}</span>,
      <div key="t"><p className="font-medium text-foreground">{t.destination}</p><p className="text-[11px] text-muted-foreground">{t.notes ?? ""}</p></div>,
      <div key="p">{t.contactName ?? "—"}{t.contactPhone && <p className="text-[11px] text-muted-foreground">{t.contactPhone}</p>}</div>,
      <div key="d">{t.driverName ?? "—"}{t.vehiclePlate && <p className="text-[11px] text-muted-foreground">{t.vehiclePlate}</p>}</div>,
      <Badge variant={t.status === "ARRIVED" ? "success" : t.status === "GAGAL" ? "danger" : t.status === "IN_TRANSIT" ? "gold" : "neutral"} key="st">{STATUS_LABEL[t.status] ?? t.status}</Badge>,
      <div className="text-xs" key="pod">
        {t.podRecipientName ? (
          <>
            <p className="font-medium text-foreground">{t.podRecipientName}</p>
            <p className="text-muted-foreground">{t.podAt ? formatDateTime(t.podAt) : "—"}</p>
            <div className="mt-0.5 flex flex-wrap gap-2">
              {t.podPhotoUrl && <a href={t.podPhotoUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">Foto</a>}
              {t.podSignatureUrl && <a href={t.podSignatureUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">TTD</a>}
              {t.podGeo && <span className="text-muted-foreground">{t.podGeo}</span>}
            </div>
          </>
        ) : <span className="text-muted-foreground">—</span>}
      </div>,
      <div className="flex flex-wrap items-center justify-end gap-1.5" key="a">
        <TrackingShareButton taskId={t.id} />
        {t.status === "WAITING" && (
          <ActionForm action={setDeliveryStatusFormAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="status" value="IN_TRANSIT" />
            <Button type="submit" size="compact" variant="outline">Kirim</Button>
          </ActionForm>
        )}
        {t.status === "IN_TRANSIT" && (
          <>
            <ActionForm action={setDeliveryStatusFormAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="status" value="ARRIVED" />
              <Button type="submit" size="compact" variant="success">Sampai</Button>
            </ActionForm>
            <ActionForm action={setDeliveryStatusFormAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="status" value="GAGAL" />
              <Button type="submit" size="compact" variant="ghost" className="text-muted-foreground">Gagal</Button>
            </ActionForm>
          </>
        )}
        {t.status === "GAGAL" && (
          <ActionForm action={setDeliveryStatusFormAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="status" value="IN_TRANSIT" />
            <Button type="submit" size="compact" variant="ghost">Kirim Ulang</Button>
          </ActionForm>
        )}
        <DeleteRowButton id={t.id} action={deleteDeliveryTasksAction} title="Hapus tugas kiriman ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Pengiriman"
        description="Tugas pengiriman: tujuan, penerima, pengemudi, jadwal, status, dan bukti terima (POD). Kurir mengisi POD lewat aplikasi mobile /m/kurir."
        actions={null}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createDeliveryVoidAction} className="flex flex-wrap items-end gap-2">
            <Input name="destination" required placeholder="Tujuan" className="w-[220px]" />
            <Input name="contactName" placeholder="Nama penerima" className="w-[150px]" />
            <Input name="contactPhone" placeholder="No. WA penerima" className="w-[150px]" />
            <Input name="driverName" placeholder="Pengemudi" className="w-[150px]" />
            <Input name="vehiclePlate" placeholder="Plat" className="w-[110px]" />
            <Input name="scheduledAt" type="datetime-local" className="w-[200px]" />
            <Button type="submit">
              <TruckIcon className="h-4 w-4" />
              Jadwalkan
            </Button>
          </ActionForm>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Link href="/delivery" className={`rounded-full px-2.5 py-1 ring-1 ${!sp.status ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Semua</Link>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <Link key={k} href={`/delivery?status=${k}`} className={`rounded-full px-2.5 py-1 ring-1 ${sp.status === k ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>{v}</Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {ordered.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <RouteIcon className="h-3.5 w-3.5" />
                Rute kirim hari ini
                {routePlan.mapped > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {routePlan.mapped} GPS · ~{routePlan.totalKm.toFixed(1)} km (nn)
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">urut jadwal; sisip GPS nearest-neighbor</span>
              </span>
              <TableExportButtons
                filename={`rute-hari-ini`}
                columns={[
                  { key: "no", label: "No" },
                  { key: "tujuan", label: "Tujuan" },
                  { key: "distrik", label: "Wilayah" },
                  { key: "waktu", label: "Waktu" },
                  { key: "penerima", label: "Penerima" },
                  { key: "pengemudi", label: "Pengemudi" },
                  { key: "gps", label: "GPS" },
                ]}
                rows={ordered.map((t, i) => ({
                  no: String(i + 1),
                  tujuan: t.destination,
                  distrik: t.district ?? "",
                  waktu: t.scheduledAt ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(t.scheduledAt) : "-",
                  penerima: t.contactName ?? "",
                  pengemudi: t.driverName ?? "",
                  gps: t.lat !== null && t.lng !== null ? `${t.lat},${t.lng}` : "",
                }))}
                sheetName="Rute"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map((t, i) => (
                <div key={t.taskId} className="flex items-start gap-2.5 rounded-xl bg-surface-dim px-3 py-2 ring-1 ring-line/10">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-semibold text-foreground">{t.destination}</p>
                    <p className="truncate text-muted-foreground">
                      {t.scheduledAt ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(t.scheduledAt) : "—"}
                      {t.district ? ` · ${t.district}` : ""}
                      {t.driverName ? ` · ${t.driverName}` : ""}
                      {t.status && t.status !== "WAITING" ? ` · ${t.status.toLowerCase()}` : ""}
                    </p>
                  </div>
                  {t.lat !== null && t.lng !== null && (
                    <a
                      href={`https://maps.google.com/?q=${t.lat},${t.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto shrink-0 text-[10px] font-semibold text-primary hover:underline"
                    >
                      GPS
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <span className="text-xs font-medium text-muted-foreground">{tasks.length} tugas</span>
          </div>
                    <RscGrid
            columns={rscColumns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada tugas pengiriman"
            unit="tugas"
            bulkDelete={{ action: deleteDeliveryTasksAction, confirm: "Hapus tugas kiriman terpilih? (yang sudah tiba tidak bisa dihapus)" }}
            exportable={{
              filename: "pengiriman",
              columns: [{ key: "jadwal", label: "Jadwal" }, { key: "tujuan", label: "Tujuan" }, { key: "penerima", label: "Penerima" }, { key: "pengemudi", label: "Pengemudi" }, { key: "plat", label: "Plat" }, { key: "status", label: "Status" }, { key: "pod", label: "POD" }],
              values: tasks.map((t) => ({ jadwal: formatDateTime(t.scheduledAt), tujuan: t.destination, penerima: (t.contactName ?? "") + (t.contactPhone ? " · " + t.contactPhone : ""), pengemudi: t.driverName ?? "", plat: t.vehiclePlate ?? "", status: t.status, pod: t.podRecipientName ?? "" })),
              sheetName: "Pengiriman",
            }}
          />

        </CardContent>
      </Card>
    </div>
  );
}
