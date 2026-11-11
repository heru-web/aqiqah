import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { deleteKitchenTasksAction } from "@/server/actions/table-ops";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProductionBatchVoidAction, advanceProdStageFormAction, setProdQcFormAction } from "@/server/actions/erp";
import { listInventoryItems, listProductionBatches } from "@/server/services/erp";
import { kitchenSummary, listKitchenTasks } from "@/server/services/periods";
import { setKitchenTaskStatusFormAction } from "@/server/actions/ops-extra";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { CookingPotIcon, FactoryIcon } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {
  RPH: "RPH (sembelih)",
  POTONG: "Potong",
  MASAK: "Masak",
  PACKING: "Packing",
  QC: "QC",
  SIAP: "Siap",
};

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; kstatus?: string }>;
}) {
  const user = await requirePagePermission("production.batches.view");
  const sp = await searchParams;
  const [batches, items, kitchen, ksum] = await Promise.all([
    listProductionBatches(user, sp.stage),
    listInventoryItems(user),
    listKitchenTasks({ branchId: user.branchId, status: sp.kstatus, limit: 50 }),
    kitchenSummary(user.branchId),
  ]);


  const batchColumns: RscColumn[] = [
    { key: "batch", header: "Batch" },
    { key: "item", header: "Item" },
    { key: "qty", header: "Qty", align: "right" },
    { key: "tahap", header: "Tahap" },
    { key: "qc", header: "QC" },
    { key: "hpp", header: "HPP", align: "right" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const batchGridRows: RscRow[] = batches.map((b) => ({
    id: b.id,
    cells: [
      <span className="font-data text-xs text-primary" key="b">{b.batchNumber}</span>,
      <span className="text-sm" key="i">{b.itemName}</span>,
      <span className="tabular-nums" key="q">{b.qtyPlanned}</span>,
      <Badge variant={b.stage === "SIAP" ? "success" : "info"} key="s">{STAGE_LABEL[b.stage] ?? b.stage}</Badge>,
      <Badge variant={b.qcStatus === "PASS" ? "success" : b.qcStatus === "FAIL" ? "danger" : "neutral"} key="q">{b.qcStatus}</Badge>,
      <span className="tabular-nums" key="h">{formatIDR(b.hppCost)}</span>,
      <div className="flex flex-wrap items-center justify-end gap-1.5" key="a">
        {b.stage !== "SIAP" && (
          <ActionForm action={advanceProdStageFormAction}><input type="hidden" name="id" value={b.id} /><Button type="submit" size="compact" variant="outline" disabled={b.stage === "QC" && b.qcStatus !== "PASS"}>Lanjut</Button></ActionForm>
        )}
        {b.stage === "QC" && <>
        <ActionForm action={setProdQcFormAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="qc" value="PASS" /><Button type="submit" size="compact" variant="success">QC Lolos</Button></ActionForm>
        <ActionForm action={setProdQcFormAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="qc" value="FAIL" /><Button type="submit" size="compact" variant="ghost" className="text-muted-foreground">QC Gagal</Button></ActionForm>
        </>}
      </div>,
    ],
  }));

  const taskColumns: RscColumn[] = [
    { key: "tugas", header: "Tugas" },
    { key: "order", header: "Order" },
    { key: "qty", header: "Qty", align: "right" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const taskGridRows: RscRow[] = kitchen.map((k) => ({
    id: k.task.id,
    cells: [
      <span className="text-sm text-foreground" key="t">{k.task.description}</span>,
      <span className="font-data text-xs text-muted-foreground" key="o">{k.orderNumber ?? "—"}</span>,
      <span className="tabular-nums" key="q">{k.task.quantity}</span>,
      <Badge variant={k.task.status === "SIAP" ? "success" : "danger"} key="st">{k.task.status === "SIAP" ? "siap" : "menunggu"}</Badge>,
      <ActionForm action={setKitchenTaskStatusFormAction} className="flex items-center justify-end gap-1.5" key="a">
        <input type="hidden" name="id" value={k.task.id} />
        <input type="hidden" name="status" value={k.task.status === "SIAP" ? "MENUNGGU" : "SIAP"} />
        <Button size="compact" variant={k.task.status === "SIAP" ? "outline" : "success"} type="submit">{k.task.status === "SIAP" ? "Kembalikan" : "Tandai Siap"}</Button>
      </ActionForm>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Produksi"
        description="Batch produksi (minimum viable): batch, tahapan RPH→Potong→Masak→Packing→QC→Siap, dan QC checklist."
        actions={null}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createProductionBatchVoidAction} className="flex flex-wrap items-end gap-2">
            <Input name="itemName" required placeholder="Nama produk/batch" className="w-[220px]" />
            <Input name="qtyPlanned" type="number" min={1} required placeholder="Qty rencana" className="w-[130px]" />
            <select
              name="inventoryItemId"
              className="h-10 rounded-xl bg-surface px-3 text-sm ring-1 ring-line/15"
              defaultValue=""
              title="Hubungkan ke item inventaris agar stok berkurang FIFO saat batch SIAP"
            >
              <option value="">Tanpa item inventaris</option>
              {items
                .filter((it) => it.isActive)
                .map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} · stok {it.qty} {it.unit}
                  </option>
                ))}
            </select>
            <Input name="notes" placeholder="Catatan" className="w-[200px]" />
            <Button type="submit">
              <FactoryIcon className="h-4 w-4" />
              Buat Batch
            </Button>
          </ActionForm>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Link href="/production" className={`rounded-full px-2.5 py-1 ring-1 ${!sp.stage ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Semua</Link>
            {Object.entries(STAGE_LABEL).map(([k, v]) => (
              <Link key={k} href={`/production?stage=${k}`} className={`rounded-full px-2.5 py-1 ring-1 ${sp.stage === k ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>{v}</Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <span className="text-xs font-medium text-muted-foreground">{batches.length} batch</span>
          </div>
                    <RscGrid
            columns={batchColumns}
            rows={batchGridRows}
            emptyTitle="Belum ada batch"
            unit="batch"
            exportable={{
              filename: "produksi",
              columns: [{ key: "batch", label: "Batch" }, { key: "item", label: "Item" }, { key: "qty", label: "Qty" }, { key: "tahap", label: "Tahap" }, { key: "qc", label: "QC" }, { key: "hpp", label: "HPP" }, { key: "created", label: "Dibuat" }],
              values: batches.map((b) => ({ batch: b.batchNumber, item: b.itemName, qty: b.qtyPlanned, tahap: b.stage, qc: b.qcStatus, hpp: b.hppCost.toString(), created: formatDateTime(b.createdAt) })),
              sheetName: "Produksi",
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CookingPotIcon className="h-3.5 w-3.5" />
                Tugas dapur (BOM otomatis dari order)
              </span>
              <Badge variant="danger">menunggu {ksum.menunggu}</Badge>
              <Badge variant="success">siap {ksum.siap}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Link href="/production" className={`rounded-full px-2.5 py-1 ring-1 ${!sp.kstatus ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Semua</Link>
              <Link href="/production?kstatus=MENUNGGU" className={`rounded-full px-2.5 py-1 ring-1 ${sp.kstatus === "MENUNGGU" ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Menunggu</Link>
              <Link href="/production?kstatus=SIAP" className={`rounded-full px-2.5 py-1 ring-1 ${sp.kstatus === "SIAP" ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Siap</Link>
            </div>
          </div>
                    <RscGrid
            columns={taskColumns}
            rows={taskGridRows}
            selectable
            emptyTitle="Belum ada tugas dapur"
            unit="tugas"
            bulkDelete={{ action: deleteKitchenTasksAction, confirm: "Hapus tugas dapur terpilih?" }}
            exportable={{
              filename: "tugas-dapur",
              columns: [{ key: "tugas", label: "Tugas" }, { key: "order", label: "Order" }, { key: "qty", label: "Qty" }, { key: "status", label: "Status" }],
              values: kitchen.map((k) => ({ tugas: k.task.description, order: k.orderNumber ?? "", qty: k.task.quantity, status: k.task.status })),
              sheetName: "Tugas Dapur",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
