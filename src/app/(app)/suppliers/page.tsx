import { ActionForm } from "@/components/app/action-form";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { DeleteRowButton } from "@/components/app/table-extras";
import { deleteSuppliersAction } from "@/server/actions/table-ops";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getSupplier, listSuppliers } from "@/server/services/suppliers";
import { saveSupplierFormAction, toggleSupplierActiveFormAction } from "@/server/actions/herd";
import { ArchiveRestoreIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  HEWAN: "Hewan",
  BAHAN: "Bahan",
  JASA: "Jasa",
  LAIN: "Lain-lain",
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string; showAll?: string }>;
}) {
  await requirePagePermission("inventory.procurement.view");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const showAll = sp.showAll === "1";
  const [rows, all, editing] = await Promise.all([
    listSuppliers({ q, includeInactive: showAll }),
    listSuppliers({ includeInactive: true }),
    sp.edit ? getSupplier(sp.edit) : Promise.resolve(null),
  ]);

  const total = all.length;
  const active = all.filter((s) => s.isActive).length;
  const breeders = all.filter((s) => s.type === "HEWAN").length;
  const linkedAnimals = all.reduce((sum, s) => sum + s.animalCount, 0);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (showAll) params.set("showAll", "1");
  const editHref = (id: string) => {
    const p = new URLSearchParams(params);
    p.set("edit", id);
    return `/suppliers?${p.toString()}#form-supplier`;
  };


  const rscColumns: RscColumn[] = [
    { key: "nama", header: "Supplier" },
    { key: "tipe", header: "Tipe" },
    { key: "kontak", header: "Kontak" },
    { key: "kota", header: "Kota" },
    { key: "hewan", header: "Hewan", align: "right" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = rows.map((s) => ({
    id: s.id,
    cells: [
      <div key="n"><p className="font-medium text-foreground">{s.name}</p>{s.notes && <p className="text-[11px] text-muted-foreground">{s.notes}</p>}</div>,
      <Badge variant={s.type === "HEWAN" ? "gold" : "neutral"} key="t">{s.type}</Badge>,
      <div key="c"><p className="text-sm text-foreground">{s.phone ?? "—"}</p>{s.email && <p className="text-[11px] text-muted-foreground">{s.email}</p>}</div>,
      <span className="text-muted-foreground" key="ct">{s.city ?? "—"}</span>,
      <span className="tabular-nums" key="a">{s.animalCount > 0 ? s.animalCount : <span className="text-muted-foreground">—</span>}</span>,
      <Badge variant={s.isActive ? "success" : "neutral"} key="st">{s.isActive ? "aktif" : "non-aktif"}</Badge>,
      <div className="flex flex-wrap items-center justify-end gap-1" key="act">
        <Link href={editHref(s.id)}><Button size="compact" variant="ghost"><PencilIcon className="h-3.5 w-3.5" /> Ubah</Button></Link>
        <ActionForm action={toggleSupplierActiveFormAction}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="active" value={s.isActive ? "0" : "1"} />
          <Button size="compact" variant="ghost" className="text-muted-foreground"><ArchiveRestoreIcon className="h-3.5 w-3.5" />{s.isActive ? "Non-aktifkan" : "Aktifkan"}</Button>
        </ActionForm>
        <DeleteRowButton id={s.id} action={deleteSuppliersAction} title={"Hapus supplier " + s.name + "?"} />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Supplier"
        description="Pemasok hewan, bahan, dan jasa. Data supplier dipakai saat membeli hewan ternak dan bahan produksi."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Supplier", value: total },
          { label: "Aktif", value: active },
          { label: "Pemasok Hewan", value: breeders },
          { label: "Hewan Terhubung", value: linkedAnimals },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4" id="form-supplier">
        <CardContent className="p-4">
          <ActionForm action={saveSupplierFormAction} className="space-y-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Nama supplier *</p>
                <Input name="name" required defaultValue={editing?.name ?? ""} placeholder="CV Berkah Ternak" className="w-[240px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tipe</p>
                <select
                  name="type"
                  defaultValue={editing?.type ?? "HEWAN"}
                  className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15"
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Telepon</p>
                <Input name="phone" defaultValue={editing?.phone ?? ""} placeholder="0812…" className="w-[150px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Kota</p>
                <Input name="city" defaultValue={editing?.city ?? ""} className="w-[140px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <Input name="email" type="email" defaultValue={editing?.email ?? ""} className="w-[190px]" />
              </div>
              <Button type="submit">
                {editing ? <PencilIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                {editing ? "Simpan Perubahan" : "Tambah Supplier"}
              </Button>
              {editing && (
                <Link href="/suppliers">
                  <Button type="button" variant="ghost">Batal</Button>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Alamat</p>
                <Textarea name="address" defaultValue={editing?.address ?? ""} rows={2} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Catatan</p>
                <Textarea name="notes" defaultValue={editing?.notes ?? ""} rows={2} />
              </div>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{rows.length} supplier</span>
          </div>
                    <RscGrid
            columns={rscColumns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada supplier"
            unit="supplier"
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <form action="/suppliers" method="GET" className="flex items-center gap-2">
                  <Input name="q" defaultValue={q ?? ""} placeholder="Cari nama/telepon/kota…" className="h-9 w-[230px]" />
                  {showAll && <input type="hidden" name="showAll" value="1" />}
                  <Button type="submit" size="compact" variant="outline"><SearchIcon className="h-3.5 w-3.5" /> Cari</Button>
                </form>
                <Link href={showAll ? (q ? "/suppliers?q=" + encodeURIComponent(q) : "/suppliers") : "/suppliers?showAll=1"} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  {showAll ? "Sembunyikan non-aktif" : "Tampilkan non-aktif"}
                </Link>
              </div>
            }
            bulkDelete={{ action: deleteSuppliersAction, confirm: "Hapus supplier terpilih?" }}
            exportable={{
              filename: "supplier",
              columns: [{ key: "name", label: "Nama" }, { key: "type", label: "Tipe" }, { key: "phone", label: "Telepon" }, { key: "city", label: "Kota" }, { key: "animals", label: "Hewan" }, { key: "status", label: "Status" }],
              values: rows.map((s) => ({ name: s.name, type: s.type, phone: s.phone ?? "", city: s.city ?? "", animals: s.animalCount, status: s.isActive ? "aktif" : "non-aktif" })),
              sheetName: "Supplier",
            }}
          />

        </CardContent>
      </Card>
    </div>
  );
}
