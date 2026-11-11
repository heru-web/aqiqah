import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { RowEditDialog, DeleteRowButton } from "@/components/app/table-extras";
import { deleteInventoryItemsAction, updateInventoryItemFormAction } from "@/server/actions/table-ops";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInventoryItemVoidAction, adjustStockFormAction, setItemActiveFormAction } from "@/server/actions/erp";
import { listInventoryItems } from "@/server/services/erp";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatIDR } from "@/lib/utils";
import { ArchiveRestoreIcon, PackagePlusIcon } from "lucide-react";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ showAll?: string }>;
}) {
  const user = await requirePagePermission("inventory.stock.view");
  const { showAll } = await searchParams;
  const items = await listInventoryItems(user, showAll === "1");


  const rscColumns: RscColumn[] = [
    { key: "nama", header: "Nama" },
    { key: "kategori", header: "Kategori" },
    { key: "stok", header: "Stok", align: "right" },
    { key: "nilai", header: "Nilai Stok", align: "right" },
    { key: "lokasi", header: "Lokasi" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = items.map((it) => ({
    id: it.id,
    cells: [
      <div key="n"><p className="font-medium text-foreground">{it.name}</p><p className="text-[11px] text-muted-foreground">{it.notes ?? ""}</p></div>,
      <Badge variant="neutral" key="k">{it.category}</Badge>,
      <span className="tabular-nums font-semibold" key="q"><span className={it.qty <= it.minQty && it.isActive ? "text-warning" : ""}>{it.qty}</span><span className="text-xs text-muted-foreground"> /min {it.minQty} {it.unit}</span></span>,
      <span className="tabular-nums text-muted-foreground" key="v">{formatIDR(it.stockValue)}</span>,
      <span className="text-muted-foreground" key="l">{it.location ?? "—"}</span>,
      <Badge variant={it.isActive ? "success" : "neutral"} key="st">{it.isActive ? "aktif" : "non-aktif"}</Badge>,
      <div className="flex flex-wrap items-center justify-end gap-1.5" key="a">
        <ActionForm action={adjustStockFormAction} className="flex items-center gap-1">
          <input type="hidden" name="itemId" value={it.id} />
          <input name="unitCost" placeholder="Harga beli" className="h-8 w-[100px] rounded-lg px-2 text-xs ring-1 ring-line/15" />
          <input name="qty" type="number" required placeholder="Qty" className="h-8 w-[72px] rounded-lg px-2 text-xs ring-1 ring-line/15" />
          <select name="direction" defaultValue="IN" className="h-8 rounded-lg px-1 text-xs ring-1 ring-line/15">
            <option value="IN">Masuk</option>
            <option value="OUT">Keluar</option>
            <option value="ADJUST">Set</option>
          </select>
          <input name="reason" placeholder="Ket." className="h-8 w-[110px] rounded-lg px-2 text-xs ring-1 ring-line/15" />
          <Button type="submit" size="compact" variant="outline">Simpan</Button>
        </ActionForm>
        <RowEditDialog
          title={"Ubah item " + it.name}
          description="Perbarui data item inventaris."
          action={updateInventoryItemFormAction}
          fields={(
            <>
              <input type="hidden" name="itemId" value={it.id} />
              <input name="name" defaultValue={it.name} placeholder="Nama" className="h-9 w-full rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
              <div className="grid grid-cols-2 gap-2">
                <select name="category" defaultValue={it.category} className="h-9 rounded-xl bg-surface/70 px-2 text-sm ring-1 ring-line">
                  <option value="BAHAN">Bahan</option>
                  <option value="PAKET">Paket</option>
                  <option value="HEWAN">Hewan</option>
                  <option value="OLAHAN">Olahan</option>
                </select>
                <input name="unit" defaultValue={it.unit} className="h-9 rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="minQty" type="number" defaultValue={it.minQty} className="h-9 rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
                <input name="location" defaultValue={it.location ?? ""} placeholder="Lokasi" className="h-9 rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
              </div>
              <input name="notes" defaultValue={it.notes ?? ""} placeholder="Catatan" className="h-9 w-full rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
            </>
          )}
        />
        <ActionForm action={setItemActiveFormAction}>
          <input type="hidden" name="itemId" value={it.id} />
          <input type="hidden" name="active" value={it.isActive ? "0" : "1"} />
          <Button size="compact" variant="ghost" className="text-muted-foreground" title={it.isActive ? "Non-aktifkan" : "Aktifkan"}>
            <ArchiveRestoreIcon className="h-3.5 w-3.5" />
            {it.isActive ? "Arsip" : "Aktifkan"}
          </Button>
        </ActionForm>
        <DeleteRowButton id={it.id} action={deleteInventoryItemsAction} title="Hapus item ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Inventaris"
        description="Stok barang & bahan (minimum viable): item, satuan, kartu stok masuk/keluar/penyesuaian."
        actions={null}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createInventoryItemVoidAction} className="flex flex-wrap items-end gap-2">
            <Input name="name" placeholder="Nama barang" required className="w-[220px]" />
            <select name="category" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15" defaultValue="BAHAN">
              <option value="BAHAN">Bahan</option>
              <option value="PAKET">Paket</option>
              <option value="HEWAN">Hewan</option>
              <option value="OLAHAN">Olahan</option>
            </select>
            <Input name="unit" placeholder="Satuan (kg/buah)" defaultValue="buah" className="w-[120px]" />
            <Input name="qty" type="number" min={0} defaultValue={0} placeholder="Stok awal" className="w-[120px]" />
            <Input name="unitCost" type="number" min={0} defaultValue={0} placeholder="Harga/unit (Rp)" className="w-[150px]" />
            <Input name="minQty" type="number" min={0} defaultValue={0} placeholder="Stok min." className="w-[110px]" />
            <Input name="location" placeholder="Lokasi/gudang" className="w-[160px]" />
            <Button type="submit">
              <PackagePlusIcon className="h-4 w-4" />
              Tambah
            </Button>
            {showAll === "1" && <input type="hidden" name="showAll" value="1" />}
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">{items.length} item</span>
              <a href={showAll === "1" ? "/inventory" : "/inventory?showAll=1"} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                {showAll === "1" ? "Sembunyikan non-aktif" : "Tampilkan non-aktif"}
              </a>
            </div>
          </div>
                    <RscGrid
            columns={rscColumns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada item"
            unit="item"
            bulkDelete={{ action: deleteInventoryItemsAction, confirm: "Hapus item terpilih?" }}
            exportable={{
              filename: "inventaris",
              columns: [{ key: "name", label: "Nama" }, { key: "category", label: "Kategori" }, { key: "unit", label: "Satuan" }, { key: "qty", label: "Stok" }, { key: "nilai", label: "Nilai Stok" }, { key: "minQty", label: "Min" }, { key: "location", label: "Lokasi" }, { key: "status", label: "Status" }],
              values: items.map((it) => ({ name: it.name, category: it.category, unit: it.unit, qty: it.qty, nilai: it.stockValue.toString(), minQty: it.minQty, location: it.location ?? "", status: it.isActive ? "aktif" : "non-aktif" })),
              sheetName: "Inventaris",
            }}
          />

        </CardContent>
      </Card>
    </div>
  );
}
