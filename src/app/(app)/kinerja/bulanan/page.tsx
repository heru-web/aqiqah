import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileSignatureIcon,
  RefreshCwIcon,
  SendIcon,
  UserCheckIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { defaultBranchId } from "@/lib/server/auth";
import {
  getMonthlyReviewByPeriod,
  getMonthlySupportingData,
  listMonthlyReviews,
  listEmployeePerformances,
  listCoaching,
  listRewards,
  listCorrectiveActions,
  employeeOptions,
} from "@/server/services/monthly-review";
import {
  listKpiIndicators,
  listBusinessUnits,
  listSalesChannels,
  listDepartments,
} from "@/server/services/performance";
import { listSops, listSopChecks } from "@/server/services/hr";
import {
  generateMonthlyReviewAction,
  submitMonthlyReviewAction,
  approveMonthlyReviewAction,
  recomputeEmployeePerformancesAction,
} from "@/server/actions/performance";
import {
  MasterCrudDialog,
  type MasterField,
} from "@/components/performance/master-crud-dialog";
import {
  createSopAction,
  updateSopAction,
  createCoachingAction,
  createRewardAction,
  createCorrectiveActionAction,
  updateCorrectiveStatusAction,
} from "@/server/actions/hr";
import { SopCheckDialog } from "@/components/performance/sop-check-dialog";
import { ActionButton } from "@/components/performance/action-button";
import { FormActionButton } from "@/components/performance/form-action-button";
import { PrintButton } from "@/components/performance/print-button";

function monthRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

const SECTION_LABEL: Record<string, string> = {
  COMPANY: "Perusahaan",
  BUSINESS_UNIT: "Unit Usaha",
  CHANNEL: "Saluran Penjualan",
  DEPARTMENT: "Departemen",
  INDIVIDUAL: "Individu",
};

const statusVariant: Record<string, "neutral" | "info" | "success"> = {
  DRAFT: "neutral",
  REVIEW: "info",
  APPROVED: "success",
};

const correctiveVariant: Record<string, "neutral" | "info" | "warning" | "success"> = {
  OPEN: "neutral",
  PROGRESS: "info",
  DONE: "warning",
  VERIFIED: "success",
};

function fmtNum(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export default async function KinerjaBulananPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const user = await requirePagePermission("performance.monthly.view");
  const { periode } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periode ?? "") ? (periode as string) : currentMonth();
  const range = monthRange(period);
  const branchId = user.branchId ?? (await defaultBranchId()) ?? "";

  const [
    reviewData,
    supporting,
    individual,
    emps,
    indicators,
    units,
    channels,
    depts,
    sops,
    sopChecks,
    coaching,
    rewards,
    corrective,
    history,
  ] = await Promise.all([
    branchId ? getMonthlyReviewByPeriod(branchId, range.start) : Promise.resolve(null),
    getMonthlySupportingData(range.start, range.end),
    listEmployeePerformances(range.start),
    employeeOptions(),
    listKpiIndicators(),
    listBusinessUnits(),
    listSalesChannels(),
    listDepartments(),
    listSops(),
    listSopChecks(range.start, range.end),
    listCoaching(),
    listRewards(range.start, range.end),
    listCorrectiveActions(),
    listMonthlyReviews(6),
  ]);

  const indName = new Map(indicators.map((i) => [i.id, i.name] as const));
  const unitName = new Map(units.map((u) => [u.id, u.name] as const));
  const channelName = new Map(channels.map((c) => [c.id, c.name] as const));
  const deptName = new Map(depts.map((d) => [d.dept.id, d.dept.name] as const));

  const review = reviewData?.review ?? null;
  const lines = reviewData?.lines ?? [];
  const sections = (["COMPANY", "BUSINESS_UNIT", "CHANNEL", "DEPARTMENT"] as const).map((s) => ({
    key: s,
    rows: lines.filter((l) => l.section === s),
  }));
  const individualLines = lines.filter((l) => l.section === "INDIVIDUAL");

  const empFieldOptions = emps.map((e) => ({ value: e.id, label: e.name }));
  const deptFieldOptions = depts.map((d) => ({ value: d.dept.id, label: d.dept.name }));

  const coachingFields: MasterField[] = [
    { name: "employeeId", label: "Karyawan", type: "select", required: true, options: empFieldOptions },
    { name: "date", label: "Tanggal", type: "date", required: true, defaultValue: range.end },
    { name: "type", label: "Jenis", type: "select", defaultValue: "COACHING", options: [
      { value: "COACHING", label: "Coaching" },
      { value: "REWARD", label: "Reward" },
      { value: "PIP", label: "PIP" },
    ] },
    { name: "topic", label: "Topik", required: true, placeholder: "Mis. Follow-up SLA pengiriman" },
    { name: "notes", label: "Catatan", type: "textarea" },
    { name: "nextAction", label: "Tindak lanjut", type: "textarea" },
    { name: "followUpAt", label: "Tindak lanjut pada", type: "date" },
  ];

  const rewardFields: MasterField[] = [
    { name: "employeeId", label: "Karyawan", type: "select", required: true, options: empFieldOptions },
    { name: "periodStart", label: "Periode mulai", type: "date", required: true, defaultValue: range.start },
    { name: "periodEnd", label: "Periode akhir", type: "date", required: true, defaultValue: range.end },
    { name: "type", label: "Jenis", type: "select", defaultValue: "BONUS", options: [
      { value: "BONUS", label: "Bonus" },
      { value: "INSENTIF", label: "Insentif" },
      { value: "APRESIASI", label: "Apresiasi" },
    ] },
    { name: "amount", label: "Jumlah (Rp)", type: "number", required: true },
    { name: "reason", label: "Alasan", type: "textarea", required: true },
  ];

  const correctiveFields: MasterField[] = [
    { name: "employeeId", label: "Karyawan", type: "select", required: true, options: empFieldOptions },
    { name: "periodStart", label: "Periode mulai", type: "date", required: true, defaultValue: range.start },
    { name: "periodEnd", label: "Periode akhir", type: "date", required: true, defaultValue: range.end },
    { name: "issue", label: "Masalah", type: "textarea", required: true },
    { name: "actionPlan", label: "Rencana tindakan", type: "textarea", required: true },
    { name: "dueDate", label: "Tenggat", type: "date", required: true, defaultValue: range.end },
  ];

  const sopFields: MasterField[] = [
    { name: "code", label: "Kode", required: true, placeholder: "SOP-HR-01" },
    { name: "title", label: "Judul", required: true },
    { name: "departmentId", label: "Departemen", type: "select", options: deptFieldOptions },
    { name: "version", label: "Versi", defaultValue: "1.0" },
  ];

  const nextCorrective = (status: string): string | null =>
    status === "OPEN" ? "PROGRESS" : status === "PROGRESS" ? "DONE" : status === "DONE" ? "VERIFIED" : null;

  return (
    <div>
      <PageHeader
        title="Review Bulanan"
        description={`Periode ${period} · skor perusahaan, dukungan SDM, skor individu, dan pengesahan.`}
        actions={
          <div className="flex gap-2">
            <PrintButton />
            <Link href="/kinerja">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="h-4 w-4" />
                Dasbor
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4 print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form action="/kinerja/bulanan" method="GET" className="flex flex-wrap items-end gap-3">
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
            <Badge variant={statusVariant[review?.status ?? "DRAFT"] ?? "neutral"}>{review?.status ?? "BELUM ADA"}</Badge>
            {!review && (
              <FormActionButton
                action={generateMonthlyReviewAction}
                fields={{ period }}
                label="Buat Review"
                icon={<FileSignatureIcon className="h-4 w-4" />}
                variant="default"
                successMessage="Review bulanan dibuat"
              />
            )}
            {review && review.status !== "APPROVED" && (
              <FormActionButton
                action={generateMonthlyReviewAction}
                fields={{ period }}
                label="Generate Ulang"
                icon={<RefreshCwIcon className="h-4 w-4" />}
                confirmMessage="Generate ulang akan mengganti seluruh baris review (kecuali yang sudah APPROVED). Lanjutkan?"
                successMessage="Review digenerate ulang"
              />
            )}
            {review && (review.status === "DRAFT" || review.status === "REVIEW") && (
              <FormActionButton
                action={recomputeEmployeePerformancesAction}
                fields={{ period }}
                label="Hitung Skor Individu"
                icon={<UserCheckIcon className="h-4 w-4" />}
                successMessage="Skor individu dihitung ulang"
              />
            )}
            {review && review.status === "DRAFT" && (
              <ActionButton
                action={submitMonthlyReviewAction}
                params={[review.id]}
                label="Ajukan"
                icon={<SendIcon className="h-4 w-4" />}
                variant="secondary"
                successMessage="Review diajukan"
              />
            )}
            {review && review.status === "REVIEW" && (
              <ActionButton
                action={approveMonthlyReviewAction}
                params={[review.id]}
                label="Setujui"
                icon={<CheckCircle2Icon className="h-4 w-4" />}
                variant="default"
                confirmMessage="Setujui review bulanan ini? Setelah disetujui, review terkunci."
                successMessage="Review bulanan disetujui"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skor Perusahaan</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {review ? fmtNum(Number(review.companyScore)) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Rata-rata tertimbang seluruh level</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rata-rata SOP</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {supporting.sop.average !== null ? fmtNum(supporting.sop.average) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{supporting.sop.checks} pengecekan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kehadiran</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {fmtNum(supporting.attendance.attendanceScore)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {supporting.attendance.hadir} hadir · {supporting.attendance.terlambat} terlambat ·{" "}
              {supporting.attendance.alpa} alpa
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skor Individu</p>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {(() => {
                const scored = individual.filter((p) => p.finalScore !== null);
                if (scored.length === 0) return "—";
                const avg = scored.reduce((s, p) => s + (p.finalScore ?? 0), 0) / scored.length;
                return fmtNum(Math.round(avg * 100) / 100);
              })()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{individual.length} karyawan dinilai</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 space-y-4">
        {sections.map(({ key, rows }) =>
          rows.length === 0 ? null : (
            <Card key={key}>
              <CardHeader>
                <CardTitle>Level {SECTION_LABEL[key]}</CardTitle>
                <CardDescription>Baris indikator hasil generate (target vs aktual).</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Objek</TableHead>
                      <TableHead>Indikator</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Aktual</TableHead>
                      <TableHead className="text-right">Skor</TableHead>
                      <TableHead className="text-right">Bobot</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-foreground">
                          {l.section === "BUSINESS_UNIT"
                            ? (unitName.get(l.refId ?? "") ?? "—")
                            : l.section === "CHANNEL"
                              ? (channelName.get(l.refId ?? "") ?? "—")
                              : l.section === "DEPARTMENT"
                                ? (deptName.get(l.refId ?? "") ?? "—")
                                : "Perusahaan"}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {l.indicatorId ? (indName.get(l.indicatorId) ?? "—") : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(Number(l.targetValue))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(Number(l.actualValue))}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtNum(Number(l.score))}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtNum(Number(l.weight))}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Skor Individu</CardTitle>
          <CardDescription>KPI · SOP · Kehadiran · Disiplin (bobot 60 · 15 · 15 · 10).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIP</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead className="text-right">KPI</TableHead>
                <TableHead className="text-right">SOP</TableHead>
                <TableHead className="text-right">Hadir</TableHead>
                <TableHead className="text-right">Disiplin</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {individual.length === 0 && individualLines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Belum ada skor individu. Klik “Buat Review” atau “Hitung Skor Individu”.
                  </TableCell>
                </TableRow>
              )}
              {individual.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{p.employeeNumber}</TableCell>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.positionName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.kpiScore)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.sopScore)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.attendanceScore)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.disciplineScore)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtNum(p.finalScore)}</TableCell>
                  <TableCell>
                    {p.grade ? (
                      <Badge variant={p.grade === "A" ? "success" : p.grade === "B" ? "info" : p.grade === "C" ? "warning" : "danger"}>
                        {p.grade}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Belum lengkap</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>SOP</CardTitle>
                <CardDescription>{sops.length} SOP aktif · {sopChecks.length} pengecekan periode ini.</CardDescription>
              </div>
              <div className="flex gap-2 print:hidden">
                <SopCheckDialog sops={sops} employees={emps} periodStart={range.start} periodEnd={range.end} />
                <MasterCrudDialog title="Tambah SOP" fields={sopFields} action={createSopAction} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead className="print:hidden" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sops.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold text-primary">{s.code}</TableCell>
                    <TableCell className="text-foreground">{s.title}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{s.version}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.departmentName ?? "Semua"}</TableCell>
                    <TableCell className="print:hidden">
                      <MasterCrudDialog
                        title={`Ubah SOP ${s.code}`}
                        fields={[
                          { name: "title", label: "Judul", required: true },
                          { name: "departmentId", label: "Departemen", type: "select", options: deptFieldOptions },
                          { name: "version", label: "Versi" },
                          { name: "isActive", label: "Aktif", type: "checkbox", defaultValue: s.isActive ? "true" : "false" },
                        ]}
                        action={updateSopAction}
                        editValues={{
                          id: s.id,
                          title: s.title,
                          departmentId: s.departmentId ?? "",
                          version: s.version ?? "",
                          isActive: s.isActive ? "true" : "false",
                        }}
                        trigger={<Button variant="outline" size="sm">Ubah</Button>}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {sops.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Belum ada SOP.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Absensi Periode</CardTitle>
            <CardDescription>
              {supporting.attendance.total} rekap hari-orang · skor disiplin{" "}
              {fmtNum(supporting.attendance.disciplineScore)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ["Hadir", supporting.attendance.hadir],
                  ["Terlambat", supporting.attendance.terlambat],
                  ["Izin", supporting.attendance.izin],
                  ["Sakit", supporting.attendance.sakit],
                  ["Alpa", supporting.attendance.alpa],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-2xl bg-surface/60 p-3 text-center ring-1 ring-border">
                  <p className="font-display text-xl font-bold text-foreground">{v}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Coaching & Pengembangan</CardTitle>
                <CardDescription>{supporting.coachingCount} catatan periode ini.</CardDescription>
              </div>
              <div className="print:hidden">
                <MasterCrudDialog title="Catat Coaching / PIP" fields={coachingFields} action={createCoachingAction} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Topik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coaching.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada catatan coaching.
                    </TableCell>
                  </TableRow>
                )}
                {coaching.slice(0, 8).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{c.date}</TableCell>
                    <TableCell className="text-foreground">{c.employeeName}</TableCell>
                    <TableCell>
                      <Badge variant={c.type === "PIP" ? "danger" : c.type === "REWARD" ? "success" : "info"}>
                        {c.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.topic}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Reward</CardTitle>
                <CardDescription>
                  {supporting.rewards.count} reward · total Rp {supporting.rewards.totalAmount.toLocaleString("id-ID")}.
                </CardDescription>
              </div>
              <div className="print:hidden">
                <MasterCrudDialog title="Beri Reward" fields={rewardFields} action={createRewardAction} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada reward periode ini.
                    </TableCell>
                  </TableRow>
                )}
                {rewards.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground">{r.employeeName}</TableCell>
                    <TableCell>
                      <Badge variant="success">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      Rp {Math.round(Number(r.amount ?? 0) / 100).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Tindakan Korektif / PIP</CardTitle>
              <CardDescription>{corrective.length} tindakan terkait periode manapun.</CardDescription>
            </div>
            <div className="print:hidden">
              <MasterCrudDialog title="Tindakan Korektif" fields={correctiveFields} action={createCorrectiveActionAction} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                <TableHead>Masalah</TableHead>
                <TableHead>Rencana Tindakan</TableHead>
                <TableHead>Tenggat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {corrective.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada tindakan korektif.
                  </TableCell>
                </TableRow>
              )}
              {corrective.map((c) => {
                const next = nextCorrective(c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground">{c.employeeName}</TableCell>
                    <TableCell className="max-w-56 text-sm text-muted-foreground">{c.issue}</TableCell>
                    <TableCell className="max-w-56 text-sm text-muted-foreground">{c.actionPlan}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{c.dueDate}</TableCell>
                    <TableCell>
                      <Badge variant={correctiveVariant[c.status] ?? "neutral"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="print:hidden">
                      {next && (
                        <ActionButton
                          action={updateCorrectiveStatusAction}
                          params={[c.id, next]}
                          label={`→ ${next}`}
                          size="sm"
                          successMessage={`Status ${next}`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4 print:hidden">
        <CardHeader>
          <CardTitle>Riwayat Review</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Skor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Disetujui</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link className="text-primary hover:underline" href={`/kinerja/bulanan?periode=${r.periodStart.slice(0, 7)}`}>
                      {r.periodStart.slice(0, 7)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {fmtNum(Number(r.companyScore))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? "neutral"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("id-ID") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
