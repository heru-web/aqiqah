import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { AttendanceDailyForm } from "@/components/hr/attendance-daily-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { attendanceRecap, listAttendanceForDate } from "@/server/services/hr";
import { jakartaToday } from "@/server/services/kpi-runner";

function monthRange(month: string): { start: string; end: string; label: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(`${month}-01T00:00:00+07:00`)
  );
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
    label,
  };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; bulan?: string }>;
}) {
  const user = await requirePagePermission("attendance.attendance.view");
  const sp = await searchParams;
  const today = jakartaToday();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? "") ? (sp.tanggal as string) : today;
  const month = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? (sp.bulan as string) : date.slice(0, 7);
  const { start, end, label } = monthRange(month);

  const [rows, recap] = await Promise.all([
    listAttendanceForDate(date, user.branchId),
    attendanceRecap(start, end, user.branchId),
  ]);

  const totals = recap.reduce(
    (acc, r) => ({
      hadir: acc.hadir + r.hadir,
      terlambat: acc.terlambat + r.terlambat,
      izin: acc.izin + r.izin,
      sakit: acc.sakit + r.sakit,
      alpa: acc.alpa + r.alpa,
    }),
    { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Absensi"
        description="Isi kehadiran harian karyawan. Rekap otomatis tersinkron ke skor disiplin di Review Bulanan KPI."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDaysIcon className="h-4 w-4 text-primary" />
            Absensi harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceDailyForm date={date} rows={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Rekap {label}</CardTitle>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Bulan sebelumnya">
              <Link href={`/attendance?tanggal=${date}&bulan=${shiftMonth(month, -1)}`}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Bulan berikutnya">
              <Link href={`/attendance?tanggal=${date}&bulan=${shiftMonth(month, 1)}`}>
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Hadir", totals.hadir],
              ["Terlambat", totals.terlambat],
              ["Izin", totals.izin],
              ["Sakit", totals.sakit],
              ["Alpa", totals.alpa],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-surface/60 px-3 py-2 ring-1 ring-line/10">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-display text-lg font-bold tabular-nums text-foreground">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl ring-1 ring-line/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead className="text-right">Hadir</TableHead>
                  <TableHead className="text-right">Terlambat</TableHead>
                  <TableHead className="text-right">Izin</TableHead>
                  <TableHead className="text-right">Sakit</TableHead>
                  <TableHead className="text-right">Alpa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada data karyawan.
                    </TableCell>
                  </TableRow>
                ) : (
                  recap.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.positionName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.hadir}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.terlambat}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.izin}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.sakit}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.alpa}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{r.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
