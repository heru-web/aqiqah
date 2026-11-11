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
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime } from "@/lib/utils";
import { listBranches } from "@/server/services/settings";
import { listCustomers } from "@/server/services/customers";
import { complaintSummary, listComplaints } from "@/server/services/complaints";
import { createComplaintFormAction, setComplaintStatusFormAction } from "@/server/actions/complaints";
import { deleteComplaintsAction } from "@/server/actions/table-ops";
import { PlusIcon, SearchIcon } from "lucide-react";

const SEVERITY_LABEL: Record<string, string> = { RENDAH: "Rendah", SEDANG: "Sedang", TINGGI: "Tinggi" };
const STATUS_LABEL: Record<string, string> = { BARU: "Baru", DIPROSES: "Diproses", SELESAI: "Selesai" };

const STATUS_VARIANT: Record<string, "success" | "gold" | "neutral" | "danger" | "info"> = {
  BARU: "danger",
  DIPROSES: "gold",
  SELESAI: "success",
};

const SEVERITY_VARIANT: Record<string, "success" | "gold" | "danger"> = {
  RENDAH: "success",
  SEDANG: "gold",
  TINGGI: "danger",
};

const CHANNEL_OPTIONS = ["WA", "TELEPON", "TATAP_MUKA", "EMAIL", "LAINNYA"];
const CATEGORY_OPTIONS = ["PELAYANAN", "PORSI", "RASA", "KIRIMAN", "WAKTU", "KEBERSIHAN", "LAINNYA"];

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; severity?: string }>;
}) {
  const user = await requirePagePermission("crm.followups.view");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const branchId = user.branchId ?? null;

  const [rows, summary, customerRows, branches] = await Promise.all([
    listComplaints({ branchId, status: sp.status, severity: sp.severity, q }),
    complaintSummary(branchId),
    listCustomers({ branchId: branchId ?? undefined, pageSize: 200 }).then((r) => r.rows),
    branchId ? Promise.resolve([]) : listBranches(),
  ]);

  const filteredHref = q ? `/complaints?q=${encodeURIComponent(q)}` : "/complaints";

  const columns: RscColumn[] = [
    { key: "keluhan", header: "Keluhan" },
    { key: "pelanggan", header: "Pelanggan" },
    { key: "kanal", header: "Kanal/Kategori" },
    { key: "keparahan", header: "Keparahan" },
    { key: "masuk", header: "Masuk" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = rows.map((c) => ({
    id: c.id,
    cells: [
      <div className="max-w-[280px]" key="k">
        <p className="text-sm font-medium text-foreground">{c.description}</p>
        {c.resolution && <p className="mt-0.5 text-[11px] text-success-soft-foreground">Resolusi: {c.resolution}</p>}
      </div>,
      <div key="p">
        <p className="text-sm text-foreground">{c.customerName ?? "—"}</p>
        {c.customerPhone && <p className="text-[11px] text-muted-foreground">{c.customerPhone}</p>}
        {c.orderNumber && <p className="text-[11px] text-muted-foreground">Order {c.orderNumber}</p>}
      </div>,
      <span className="text-xs text-muted-foreground" key="c">
        {(c.channel ?? "—").toLowerCase()} · {(c.category ?? "—").toLowerCase()}
      </span>,
      <Badge variant={SEVERITY_VARIANT[c.severity] ?? "neutral"} key="s">
        {SEVERITY_LABEL[c.severity] ?? c.severity}
      </Badge>,
      <span className="text-xs text-muted-foreground" key="m">{formatDateTime(c.receivedAt)}</span>,
      <div key="st">
        <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
        {c.resolvedAt && <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(c.resolvedAt)}</p>}
      </div>,
      <div className="flex flex-wrap items-center justify-end gap-1" key="a">
        <ActionForm action={setComplaintStatusFormAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={c.id} />
          <select name="status" defaultValue={c.status} className="h-8 rounded-lg bg-surface/60 px-1.5 text-xs ring-1 ring-line/15">
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Input name="resolution" defaultValue={c.resolution ?? ""} placeholder="resolusi" className="h-8 w-[120px] text-xs" />
          <Button size="compact" variant="outline" type="submit">Set</Button>
        </ActionForm>
        <DeleteRowButton id={c.id} action={deleteComplaintsAction} title="Hapus keluhan ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Keluhan Pelanggan"
        description="Customer service: keluhan (complaint) masuk per kanal, tingkat keparahan, kategori, penyelesaian, dan resolusi."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Keluhan", value: summary.total },
          { label: "Baru", value: summary.BARU },
          { label: "Diproses", value: summary.DIPROSES },
          { label: "Tinggi (terbuka)", value: summary.tinggi },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createComplaintFormAction} className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              {branches.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Cabang</p>
                  <select name="branchId" required className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                    <option value="">— pilih cabang —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="branchId" value={branchId ?? ""} />
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Pelanggan</p>
                <select name="customerId" className="h-10 max-w-[240px] rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  <option value="">— tanpa pelanggan —</option>
                  {customerRows.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Kanal</p>
                <select name="channel" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Kategori</p>
                <select name="category" defaultValue="PELAYANAN" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Keparahan</p>
                <select name="severity" defaultValue="SEDANG" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <Button type="submit">
                <PlusIcon className="h-4 w-4" />
                Catat Keluhan
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Deskripsi keluhan *</p>
              <Textarea name="description" required rows={2} placeholder="Jelaskan keluhan pelanggan…" />
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <RscGrid
            columns={columns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada keluhan"
            unit="keluhan"
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <form action="/complaints" method="GET" className="flex flex-wrap items-center gap-2">
                  <Input name="q" defaultValue={q ?? ""} placeholder="Cari deskripsi/kategori/pelanggan…" className="h-9 w-[240px]" />
                  {sp.status && <input type="hidden" name="status" value={sp.status} />}
                  {sp.severity && <input type="hidden" name="severity" value={sp.severity} />}
                  <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                    <option value="">Semua status</option>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select name="severity" defaultValue={sp.severity ?? ""} className="h-9 rounded-xl bg-surface/60 px-2 text-xs ring-1 ring-line/15">
                    <option value="">Semua keparahan</option>
                    {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <Button type="submit" size="compact" variant="outline">
                    <SearchIcon className="h-3.5 w-3.5" /> Filter
                  </Button>
                  <Link href={filteredHref} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                    Reset
                  </Link>
                </form>
                <span className="text-xs font-medium text-muted-foreground">{rows.length} keluhan</span>
              </div>
            }
            bulkDelete={{ action: deleteComplaintsAction, confirm: "Hapus keluhan terpilih?" }}
            exportable={{
              filename: "keluhan-pelanggan",
              columns: [
                { key: "keluhan", label: "Keluhan" },
                { key: "pelanggan", label: "Pelanggan" },
                { key: "kanal", label: "Kanal" },
                { key: "kategori", label: "Kategori" },
                { key: "keparahan", label: "Keparahan" },
                { key: "status", label: "Status" },
                { key: "resolusi", label: "Resolusi" },
              ],
              values: rows.map((c) => ({ keluhan: c.description, pelanggan: c.customerName ?? "", kanal: c.channel ?? "", kategori: c.category ?? "", keparahan: c.severity, status: c.status, resolusi: c.resolution ?? "" })),
              sheetName: "Keluhan",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
