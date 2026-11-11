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
import { deleteAnimalsAction } from "@/server/actions/table-ops";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDate, formatIDR } from "@/lib/utils";
import { listBranches } from "@/server/services/settings";
import { listSuppliers } from "@/server/services/suppliers";
import { animalSummary, getAnimal, listAnimals } from "@/server/services/animals";
import { saveAnimalFormAction, setAnimalStatusFormAction } from "@/server/actions/herd";
import { PencilIcon, PlusIcon, SearchIcon } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Tersedia",
  RESERVED: "Direservasi",
  SLAUGHTERED: "Disembelih",
  ISSUED: "Diserahkan",
  LOSS: "Hilang",
};

const STATUS_VARIANT: Record<string, "success" | "gold" | "info" | "neutral" | "danger"> = {
  AVAILABLE: "success",
  RESERVED: "gold",
  SLAUGHTERED: "info",
  ISSUED: "neutral",
  LOSS: "danger",
};

const SPECIES_LABEL: Record<string, string> = { KAMBING: "Kambing", SAPI: "Sapi" };

export default async function AnimalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; species?: string; supplierId?: string; edit?: string }>;
}) {
  const user = await requirePagePermission("inventory.stock.view");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const branchId = user.branchId ?? null;

  const [rows, summary, suppliers, branches, editing] = await Promise.all([
    listAnimals({ branchId, status: sp.status, species: sp.species, supplierId: sp.supplierId, q }),
    animalSummary(branchId),
    listSuppliers({ includeInactive: false }),
    branchId ? Promise.resolve([]) : listBranches(),
    sp.edit ? getAnimal(sp.edit) : Promise.resolve(null),
  ]);

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sp.status) params.set("status", sp.status);
  if (sp.species) params.set("species", sp.species);
  if (sp.supplierId) params.set("supplierId", sp.supplierId);
  const editHref = (id: string) => {
    const p = new URLSearchParams(params);
    p.set("edit", id);
    return `/animals?${p.toString()}#form-hewan`;
  };


  const rscColumns: RscColumn[] = [
    { key: "hewan", header: "Hewan" },
    { key: "supplier", header: "Supplier" },
    { key: "fisik", header: "Fisik" },
    { key: "harga", header: "Harga Beli", align: "right" },
    { key: "dibeli", header: "Dibeli" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = rows.map((a) => ({
    id: a.id,
    cells: [
      <div key="n"><p className="font-medium text-foreground">{(a.tagNumber ?? "Tanpa tag") + " · " + (SPECIES_LABEL[a.species] ?? a.species)}</p>
        <p className="text-[11px] text-muted-foreground">{[a.breed, a.pen ? ("Kandang " + a.pen) : null, a.branchName, a.skkhNumber ? ("SKKH " + a.skkhNumber) : null].filter(Boolean).join(" · ") || "—"}</p></div>,
      <div key="s"><p className="text-sm text-foreground">{a.supplierName ?? "—"}</p>{a.supplierPhone && <p className="text-[11px] text-muted-foreground">{a.supplierPhone}</p>}</div>,
      <span className="text-xs text-muted-foreground" key="f">{[a.weightKg ? (a.weightKg + " kg") : null, a.ageMonths ? (a.ageMonths + " bln") : null, a.gender ?? null].filter(Boolean).join(" · ") || "—"}</span>,
      <span className="tabular-nums" key="h">{formatIDR(a.purchasePrice)}</span>,
      <span className="text-xs text-muted-foreground" key="d">{a.purchasedAt ? formatDate(a.purchasedAt) : "—"}</span>,
      <Badge variant={STATUS_VARIANT[a.status] ?? "neutral"} key="st">{STATUS_LABEL[a.status] ?? a.status}</Badge>,
      <div className="flex flex-wrap items-center justify-end gap-1" key="act">
        <Link href={editHref(a.id)}><Button size="compact" variant="ghost"><PencilIcon className="h-3.5 w-3.5" /> Ubah</Button></Link>
        <ActionForm action={setAnimalStatusFormAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={a.id} />
          <select name="status" defaultValue={a.status} className="h-8 rounded-lg bg-surface/60 px-1.5 text-xs ring-1 ring-line/15">
            {Object.entries(STATUS_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </select>
          <Button size="compact" variant="outline" type="submit">Set</Button>
        </ActionForm>
        <DeleteRowButton id={a.id} action={deleteAnimalsAction} title="Hapus hewan ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Hewan Ternak"
        description="Herd/ternak: asal supplier, status ketersediaan, harga beli, dan dokumen SKKH. Hewan terhubung ke pesanan saat diproduksi."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Herd", value: summary.total },
          { label: "Tersedia", value: summary.available },
          { label: "Kambing", value: summary.kambing },
          { label: "Sapi", value: summary.sapi },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4" id="form-hewan">
        <CardContent className="p-4">
          <ActionForm action={saveAnimalFormAction} className="space-y-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Spesies</p>
                <select name="species" defaultValue={editing?.species ?? "KAMBING"} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  <option value="KAMBING">Kambing</option>
                  <option value="SAPI">Sapi</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">No. Tag / Ear tag</p>
                <Input name="tagNumber" defaultValue={editing?.tagNumber ?? ""} placeholder="K-001" className="w-[130px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Ras / Breed</p>
                <Input name="breed" defaultValue={editing?.breed ?? ""} placeholder="Etawa" className="w-[140px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Supplier</p>
                <select name="supplierId" defaultValue={editing?.supplierId ?? ""} className="h-10 w-[190px] rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  <option value="">— tanpa supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              {branches.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Cabang</p>
                  <select name="branchId" defaultValue={editing?.branchId ?? ""} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                    <option value="">— tanpa cabang —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="branchId" value={branchId ?? ""} />
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Harga beli (Rp)</p>
                <Input name="purchasePrice" type="number" min={0} defaultValue={editing ? editing.purchasePrice.toString() : 0} className="w-[140px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tanggal beli</p>
                <Input
                  name="purchasedAt"
                  type="date"
                  defaultValue={editing?.purchasedAt ? editing.purchasedAt.toISOString().slice(0, 10) : ""}
                  className="w-[150px]"
                />
              </div>
              <Button type="submit">
                {editing ? <PencilIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                {editing ? "Simpan Perubahan" : "Tambah Hewan"}
              </Button>
              {editing && (
                <Link href="/animals">
                  <Button type="button" variant="ghost">Batal</Button>
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Berat (kg)</p>
                <Input name="weightKg" defaultValue={editing?.weightKg ?? ""} placeholder="25" className="w-[100px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Umur (bulan)</p>
                <Input name="ageMonths" defaultValue={editing?.ageMonths ?? ""} placeholder="12" className="w-[110px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Jenis kelamin</p>
                <select name="gender" defaultValue={editing?.gender ?? ""} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  <option value="">—</option>
                  <option value="JANTAN">Jantan</option>
                  <option value="BETINA">Betina</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">SKKH</p>
                <Input name="skkhNumber" defaultValue={editing?.skkhNumber ?? ""} placeholder="No. SKKH" className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Kandang</p>
                <Input name="pen" defaultValue={editing?.pen ?? ""} placeholder="mis. KANDANG-A" className="w-[140px]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <select name="status" defaultValue={editing?.status ?? "AVAILABLE"} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[240px] flex-1 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Catatan</p>
                <Textarea name="notes" defaultValue={editing?.notes ?? ""} rows={1} />
              </div>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2.5">
            <form action="/animals" method="GET" className="flex flex-wrap items-center gap-2">
              <Input name="q" defaultValue={q ?? ""} placeholder="Cari tag/ras/supplier…" className="h-9 w-[200px]" />
              <select name="species" defaultValue={sp.species ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                <option value="">Semua spesies</option>
                <option value="KAMBING">Kambing</option>
                <option value="SAPI">Sapi</option>
              </select>
              <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                <option value="">Semua status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select name="supplierId" defaultValue={sp.supplierId ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                <option value="">Semua supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button type="submit" size="compact" variant="outline">
                <SearchIcon className="h-3.5 w-3.5" />
                Filter
              </Button>
              <Link href="/animals" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Reset</Link>
            </form>
            <span className="text-xs font-medium text-muted-foreground">{rows.length} hewan</span>
          </div>
                    <RscGrid
            columns={rscColumns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada hewan ternak"
            unit="hewan"
            toolbar={
              <form action="/animals" method="GET" className="flex flex-wrap items-center gap-2">
                <Input name="q" defaultValue={q ?? ""} placeholder="Cari tag/ras/kandang/supplier…" className="h-9 w-[200px]" />
                <select name="species" defaultValue={sp.species ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                  <option value="">Semua spesies</option>
                  <option value="KAMBING">Kambing</option>
                  <option value="SAPI">Sapi</option>
                </select>
                <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                  <option value="">Semua status</option>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                </select>
                <select name="supplierId" defaultValue={sp.supplierId ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                  <option value="">Semua supplier</option>
                  {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <Button type="submit" size="compact" variant="outline"><SearchIcon className="h-3.5 w-3.5" /> Filter</Button>
                <Link href="/animals" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Reset</Link>
              </form>
            }
            bulkDelete={{ action: deleteAnimalsAction, confirm: "Hapus hewan ternak terpilih?" }}
            exportable={{
              filename: "hewan-ternak",
              columns: [{ key: "tag", label: "Tag" }, { key: "spesies", label: "Spesies" }, { key: "supplier", label: "Supplier" }, { key: "kandang", label: "Kandang" }, { key: "harga", label: "Harga" }, { key: "status", label: "Status" }],
              values: rows.map((a) => ({ tag: a.tagNumber ?? "", spesies: a.species, supplier: a.supplierName ?? "", kandang: a.pen ?? "", harga: a.purchasePrice.toString(), status: a.status })),
              sheetName: "Hewan",
            }}
          />

        </CardContent>
      </Card>
    </div>
  );
}
