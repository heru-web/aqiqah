import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableExportButtons } from "@/components/app/table-export";
import { createPayrollRunVoidAction, finalizePayrollRunVoidAction, updatePayrollLineVoidAction } from "@/server/actions/erp";
import { listPayrollRuns, listPayrollLines } from "@/server/services/erp";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatIDR } from "@/lib/utils";
import { BadgeCheckIcon, CalendarPlusIcon } from "lucide-react";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; period?: string }>;
}) {
  const user = await requirePagePermission("payroll.payroll.view");
  const sp = await searchParams;
  const runs = await listPayrollRuns(user);
  const activeRunId = sp.run ?? runs[0]?.id ?? null;
  const lines = activeRunId ? await listPayrollLines(activeRunId, user) : [];
  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;

  return (
    <div>
      <PageHeader
        title="Penggajian"
        description="Payroll per periode: karyawan aktif → dasar + tunjangan − potongan; finalisasi terkunci."
        actions={null}
      />
      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createPayrollRunVoidAction} className="flex flex-wrap items-center gap-2">
            <Input name="period" type="month" required placeholder="2026-11" className="w-[170px]" />
            <Button type="submit">
              <CalendarPlusIcon className="h-4 w-4" />
              Buat / Buka Periode
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      {runs.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Belum ada periode payroll. Buat periode bulan berjalan.</CardContent></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {runs.map((r) => (
              <a key={r.id} href={`/payroll?run=${r.id}`}>
                <Badge variant={r.id === activeRunId ? "primary" : r.status === "FINAL" ? "success" : "neutral"}>
                  {r.period} · {r.status === "FINAL" ? "final" : "draft"} · Rp {formatIDR(r.totalNet)}
                </Badge>
              </a>
            ))}
          </div>

          {activeRun && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
                  <span className="text-xs font-medium text-muted-foreground">{lines.length} karyawan · periode {activeRun.period}</span>
                  <div className="flex items-center gap-1.5">
                    {activeRun.status === "DRAFT" && (
                      <ActionForm action={finalizePayrollRunVoidAction}>
                        <input type="hidden" name="runId" value={activeRun.id} />
                        <Button type="submit" size="compact" variant="success">
                          <BadgeCheckIcon className="h-3.5 w-3.5" />
                          Finalisasi
                        </Button>
                      </ActionForm>
                    )}
                    <TableExportButtons
                      filename={`payroll-${activeRun.period}`}
                      columns={[
                        { key: "employeeNumber", label: "NIP" },
                        { key: "employeeName", label: "Nama" },
                        { key: "basic", label: "Dasar" },
                        { key: "allowance", label: "Tunjangan" },
                        { key: "deduction", label: "Potongan" },
                        { key: "net", label: "Bersih" },
                      ]}
                      rows={lines.map((l) => ({
                        employeeNumber: l.employeeNumber,
                        employeeName: l.employeeName,
                        basic: formatIDR(l.basic),
                        allowance: formatIDR(l.allowance),
                        deduction: formatIDR(l.deduction),
                        net: formatIDR(l.net),
                      }))}
                      sheetName="Payroll"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIP</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-right">Dasar</TableHead>
                      {activeRun.status === "DRAFT" ? (
                        <TableHead className="text-right">Tunjangan / Potongan / Simpan</TableHead>
                      ) : (
                        <>
                          <TableHead className="text-right">Tunjangan</TableHead>
                          <TableHead className="text-right">Potongan</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Bersih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-data text-xs">{l.employeeNumber}</TableCell>
                        <TableCell>{l.employeeName}</TableCell>
                        <TableCell className="text-right font-data">{formatIDR(l.basic)}</TableCell>
                        {activeRun.status === "DRAFT" ? (
                          <TableCell>
                            <ActionForm action={updatePayrollLineVoidAction} className="flex items-center justify-end gap-1">
                              <input type="hidden" name="id" value={l.id} />
                              <Input name="allowance" type="number" min={0} defaultValue={String(l.allowance)} className="h-8 w-[110px] text-xs" />
                              <Input name="deduction" type="number" min={0} defaultValue={String(l.deduction)} className="h-8 w-[110px] text-xs" />
                              <Input name="note" defaultValue={l.note ?? ""} placeholder="Catatan" className="h-8 w-[110px] text-xs" />
                              <Button type="submit" size="compact" variant="outline">Simpan</Button>
                            </ActionForm>
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="text-right font-data">{formatIDR(l.allowance)}</TableCell>
                            <TableCell className="text-right font-data">{formatIDR(l.deduction)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-data font-semibold">{formatIDR(l.net)}</TableCell>
                      </TableRow>
                    ))}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada karyawan aktif. Tambah karyawan dulu di modul Karyawan.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
