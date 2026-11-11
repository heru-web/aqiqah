import { ArrowLeftIcon, CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { MasterCrudDialog, type MasterField } from "@/components/performance/master-crud-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listKpiIndicators,
  listKpiTargets,
  listKpiActualRows,
  weightTotals,
  listBusinessUnits,
  listSalesChannels,
  listDepartments,
  listPositions,
} from "@/server/services/performance";
import {
  createKpiIndicatorAction,
  updateKpiIndicatorAction,
  deleteKpiIndicatorAction,
  upsertKpiTargetAction,
  upsertKpiActualAction,
  submitKpiActualAction,
  verifyKpiActualAction,
  copyKpiTargetsAction,
} from "@/server/actions/performance";
import { requirePagePermission } from "@/lib/server/page-auth";
import { ActionButton } from "@/components/performance/action-button";
import { FormActionButton } from "@/components/performance/form-action-button";
import { SyncKpiButton } from "@/components/performance/sync-button";

const scopeOptions = [
  { value: "COMPANY", label: "Perusahaan" },
  { value: "BUSINESS_UNIT", label: "Unit Usaha" },
  { value: "CHANNEL", label: "Saluran" },
  { value: "DEPARTMENT", label: "Departemen" },
  { value: "POSITION", label: "Jabatan" },
];

const unitOptions = [
  { value: "CURRENCY", label: "Mata Uang (Rp)" },
  { value: "COUNT", label: "Jumlah" },
  { value: "PERCENT", label: "Persen (%)" },
  { value: "RATIO", label: "Rasio" },
  { value: "DURATION", label: "Durasi" },
  { value: "SCORE", label: "Skor" },
];

const directionOptions = [
  { value: "HIGHER_BETTER", label: "Semakin tinggi semakin baik" },
  { value: "LOWER_BETTER", label: "Semakin rendah semakin baik" },
];

const frequencyOptions = [
  { value: "DAILY", label: "Harian" },
  { value: "WEEKLY", label: "Mingguan" },
  { value: "MONTHLY", label: "Bulanan" },
];

const periodTypeOptions = [
  { value: "MONTHLY", label: "Bulanan" },
  { value: "WEEKLY", label: "Mingguan" },
  { value: "DAILY", label: "Harian (kuota per hari, dihitung per hari)" },
];

const scopeLabel: Record<string, string> = Object.fromEntries(scopeOptions.map((o) => [o.value, o.label]));
const freqLabel: Record<string, string> = Object.fromEntries(frequencyOptions.map((o) => [o.value, o.label]));
const unitLabel: Record<string, string> = Object.fromEntries(unitOptions.map((o) => [o.value, o.label]));

const statusVariant: Record<string, "neutral" | "info" | "success"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  VERIFIED: "success",
};

function jakartaMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function KinerjaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePagePermission("performance.indicators.view");
  const { periode } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periode ?? "") ? (periode as string) : jakartaMonth();
  const range = monthRange(period);

  const [indicators, targets, actuals, weights, units, channels, depts, positions] = await Promise.all([
    listKpiIndicators(),
    listKpiTargets(range.start, range.end),
    listKpiActualRows(range.start, range.end),
    weightTotals(range.start, range.end),
    listBusinessUnits(),
    listSalesChannels(),
    listDepartments(),
    listPositions(),
  ]);

  const indicatorOptions = indicators.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const scopeRefOptions = [
    { value: "", label: "Perusahaan (semua)" },
    ...units.map((u) => ({ value: u.id, label: `Unit: ${u.name}` })),
    ...channels.map((c) => ({ value: c.id, label: `Saluran: ${c.name}` })),
    ...depts.map((d) => ({ value: d.dept.id, label: `Departemen: ${d.dept.name}` })),
    ...positions.map((p) => ({ value: p.pos.id, label: `Jabatan: ${p.pos.name}` })),
  ];

  const refName = new Map<string, string>([
    ...units.map((u) => [u.id, u.name] as const),
    ...channels.map((c) => [c.id, c.name] as const),
    ...depts.map((d) => [d.dept.id, d.dept.name] as const),
    ...positions.map((p) => [p.pos.id, p.pos.name] as const),
  ]);

  const createIndicatorFields: MasterField[] = [
    { name: "code", label: "Kode", required: true, placeholder: "cth. OTD" },
    { name: "name", label: "Nama Indikator", required: true, placeholder: "cth. On-time Delivery" },
    { name: "scope", label: "Cakupan", type: "select", required: true, options: scopeOptions },
    { name: "unit", label: "Satuan", type: "select", required: true, options: unitOptions },
    { name: "direction", label: "Arah", type: "select", required: true, options: directionOptions },
    { name: "frequency", label: "Frekuensi", type: "select", required: true, options: frequencyOptions },
    { name: "formulaKey", label: "Kunci Formula (opsional)", placeholder: "cth. delivery_on_time" },
    { name: "defaultScopeRefId", label: "Objek Default (opsional, utk scorecard harian)", type: "select", options: scopeRefOptions },
    { name: "defaultWeight", label: "Bobot Default", type: "number", defaultValue: "0" },
    { name: "description", label: "Deskripsi", type: "textarea" },
  ];

  const editIndicatorFields: MasterField[] = [
    { name: "code", label: "Kode", readOnly: true },
    { name: "name", label: "Nama Indikator", required: true },
    { name: "scope", label: "Cakupan", readOnly: true },
    { name: "unit", label: "Satuan", type: "select", required: true, options: unitOptions },
    { name: "direction", label: "Arah", type: "select", required: true, options: directionOptions },
    { name: "frequency", label: "Frekuensi", type: "select", required: true, options: frequencyOptions },
    { name: "formulaKey", label: "Kunci Formula (opsional)" },
    { name: "defaultScopeRefId", label: "Objek Default (opsional)", type: "select", options: scopeRefOptions },
    { name: "defaultWeight", label: "Bobot Default", type: "number" },
    { name: "description", label: "Deskripsi", type: "textarea" },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ];

  const targetFields: MasterField[] = [
    { name: "indicatorId", label: "Indikator KPI", type: "select", required: true, options: indicatorOptions },
    { name: "scopeRefId", label: "Objek", type: "select", options: scopeRefOptions },
    { name: "periodType", label: "Tipe Periode Target", type: "select", defaultValue: "MONTHLY", options: periodTypeOptions },
    { name: "periodStart", label: "Mulai Periode", type: "date", required: true, defaultValue: range.start },
    { name: "periodEnd", label: "Akhir Periode", type: "date", required: true, defaultValue: range.end },
    { name: "targetValue", label: "Nilai Target", type: "number", required: true, defaultValue: "0" },
    { name: "weight", label: "Bobot", type: "number", required: true, defaultValue: "100" },
    { name: "notes", label: "Catatan", type: "textarea" },
  ];

  const actualFields: MasterField[] = [
    { name: "indicatorId", label: "Indikator KPI", type: "select", required: true, options: indicatorOptions },
    { name: "scopeRefId", label: "Objek", type: "select", options: scopeRefOptions },
    { name: "periodStart", label: "Mulai Periode", type: "date", required: true, defaultValue: range.start },
    { name: "periodEnd", label: "Akhir Periode", type: "date", required: true, defaultValue: range.end },
    { name: "actualValue", label: "Nilai Aktual", type: "number", required: true, defaultValue: "0" },
    { name: "notes", label: "Catatan", type: "textarea" },
  ];

  const badWeights = weights.filter((w) => Math.abs(w.total - 100) > 0.01);

  return (
    <div>
      <PageHeader
        title="Pengaturan KPI"
        description={`Indikator, target, dan aktual KPI periode ${period}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <SyncKpiButton />
            <Link href="/kinerja">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="h-4 w-4" />
                Dasbor
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-6 print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form action="/kinerja/pengaturan" method="GET" className="flex items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="periode" className="text-xs font-medium text-muted-foreground">
                Periode
              </label>
              <input
                id="periode"
                type="month"
                name="periode"
                defaultValue={period}
                className="flex h-10 rounded-2xl bg-surface/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <MasterCrudDialog
              title="Aktual KPI Manual"
              description="Masukkan aktual manual untuk indikator yang tidak terhitung otomatis."
              fields={actualFields}
              action={upsertKpiActualAction}
              trigger={
                <Button variant="secondary" size="sm">
                  + Aktual
                </Button>
              }
            />
            <FormActionButton
              action={copyKpiTargetsAction}
              fields={{ from: period, to: nextMonth(period) }}
              label={`Salin Target → ${nextMonth(period)}`}
              icon={<CopyIcon className="h-4 w-4" />}
              variant="secondary"
              successMessage="Target tersalin (idempoten)"
            />
          </div>
        </CardContent>
      </Card>

      {badWeights.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Badge variant="warning">Bobot</Badge>
            <p className="text-sm text-foreground">
              Total bobot belum 100 pada {badWeights.length} grup:{" "}
              {badWeights
                .slice(0, 6)
                .map((w) => `${scopeLabel[w.scope] ?? w.scope}${w.scopeRefId ? `/${refName.get(w.scopeRefId) ?? "objek"}` : ""} = ${w.total}`)
                .join(" · ")}
              {badWeights.length > 6 ? " …" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Indikator KPI</CardTitle>
            <CardDescription>Daftar indikator yang menjadi dasar penilaian kinerja.</CardDescription>
          </div>
          <MasterCrudDialog
            title="Indikator KPI Baru"
            fields={createIndicatorFields}
            action={createKpiIndicatorAction}
            trigger={<Button variant="secondary">+ Indikator</Button>}
          />
        </CardHeader>
        <CardContent className="p-0">
          {indicators.length === 0 ? (
            <div className="p-6">
              <EmptyState title="Belum ada indikator" description="Tambahkan indikator KPI pertama." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Cakupan</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Frekuensi</TableHead>
                  <TableHead className="text-right">Bobot</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicators.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-semibold text-primary">{i.code}</TableCell>
                    <TableCell className="font-medium text-foreground">{i.name}</TableCell>
                    <TableCell className="text-muted-foreground">{scopeLabel[i.scope] ?? i.scope}</TableCell>
                    <TableCell className="text-muted-foreground">{unitLabel[i.unit] ?? i.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{freqLabel[i.frequency] ?? i.frequency}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(i.defaultWeight).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.formulaKey ?? "manual"}</TableCell>
                    <TableCell>
                      <Badge variant={i.isActive ? "success" : "neutral"}>
                        {i.isActive ? "aktif" : "non-aktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <MasterCrudDialog
                          title="Edit Indikator KPI"
                          fields={editIndicatorFields}
                          action={updateKpiIndicatorAction}
                          editValues={{
                            id: i.id,
                            code: i.code,
                            name: i.name,
                            scope: i.scope,
                            unit: i.unit,
                            direction: i.direction,
                            frequency: i.frequency,
                            formulaKey: i.formulaKey ?? "",
                            defaultScopeRefId: i.defaultScopeRefId ?? "",
                            defaultWeight: i.defaultWeight,
                            description: i.description ?? "",
                            isActive: String(i.isActive),
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Edit">
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <ActionButton
                          action={deleteKpiIndicatorAction}
                          params={[i.id]}
                          label="Hapus"
                          icon={<Trash2Icon className="h-4 w-4" />}
                          variant="ghost"
                          confirmMessage={`Hapus indikator ${i.code}? Seluruh target & aktual ikut terhapus.`}
                          successMessage="Indikator dihapus"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Target Periode</CardTitle>
              <CardDescription>
                Target KPI {period}. “Harian” = kuota per hari untuk seluruh bulan (rerata harian).
              </CardDescription>
            </div>
            <MasterCrudDialog
              title="Target KPI"
              description="Tetapkan atau perbarui target indikator per objek."
              fields={targetFields}
              action={upsertKpiTargetAction}
              trigger={<Button variant="secondary">+ Target</Button>}
            />
          </CardHeader>
          <CardContent className="p-0">
            {targets.length === 0 ? (
              <div className="p-6">
                <EmptyState title="Belum ada target" description="Tetapkan target KPI untuk periode ini." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indikator</TableHead>
                    <TableHead>Objek</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Bobot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map(({ target, indicator }) => (
                    <TableRow key={target.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{indicator.name}</p>
                        <p className="text-xs text-muted-foreground">{indicator.code}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {target.scopeRefId ? (refName.get(target.scopeRefId) ?? "objek") : "Perusahaan"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{target.periodType}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(target.targetValue).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(target.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktual KPI</CardTitle>
            <CardDescription>
              Aktual periode {period}. AUTO dihitung tiap 23.59 WIB; MANUAL diajukan lalu diverifikasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {actuals.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Belum ada aktual"
                  description="Jalankan Sinkron atau masukkan aktual manual."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indikator</TableHead>
                    <TableHead>Objek</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actuals.map(({ actual, indicator }) => (
                    <TableRow key={actual.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{indicator.name}</p>
                        <p className="text-xs text-muted-foreground">{indicator.code}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {actual.scopeRefId ? (refName.get(actual.scopeRefId) ?? "objek") : "Perusahaan"}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">
                        {actual.periodStart} → {actual.periodEnd}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {Number(actual.actualValue).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actual.source === "AUTO" ? "info" : "neutral"}>{actual.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[actual.status] ?? "neutral"}>{actual.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {actual.status === "DRAFT" && (
                            <ActionButton
                              action={submitKpiActualAction}
                              params={[actual.id]}
                              label="Ajukan"
                              size="sm"
                              successMessage="Aktual diajukan"
                            />
                          )}
                          {actual.status !== "VERIFIED" && (
                            <ActionButton
                              action={verifyKpiActualAction}
                              params={[actual.id]}
                              label="Verifikasi"
                              size="sm"
                              variant="default"
                              successMessage="Aktual terverifikasi"
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Total Bobot per Grup</CardTitle>
          <CardDescription>Sampai 100 per grup objek agar skor tertimbang valid.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cakupan</TableHead>
                <TableHead>Objek</TableHead>
                <TableHead className="text-right">Jumlah Indikator</TableHead>
                <TableHead className="text-right">Total Bobot</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weights.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Belum ada target periode ini.
                  </TableCell>
                </TableRow>
              )}
              {weights.map((w, idx) => {
                const ok = Math.abs(w.total - 100) <= 0.01;
                return (
                  <TableRow key={`${w.scope}-${w.scopeRefId ?? "all"}-${idx}`}>
                    <TableCell className="text-muted-foreground">{scopeLabel[w.scope] ?? w.scope}</TableCell>
                    <TableCell className="text-foreground">
                      {w.scopeRefId ? (refName.get(w.scopeRefId) ?? "objek") : "Perusahaan"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{w.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{w.total}</TableCell>
                    <TableCell>
                      <Badge variant={ok ? "success" : "warning"}>{ok ? "OK" : "≠ 100"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
