import Link from "next/link";
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { defaultBranchId } from "@/lib/server/auth";
import { getDailyScorecard, listDailyScorecards, listScorecardDepartments } from "@/server/services/scorecards";
import { ScorecardForm } from "@/components/performance/scorecard-form";
import { SyncKpiButton } from "@/components/performance/sync-button";

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}

function monthRange(date: string): { start: string; end: string } {
  const prefix = date.slice(0, 7);
  const [y, m] = prefix.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${prefix}-01`,
    end: `${prefix}-${String(lastDay).padStart(2, "0")}`,
  };
}

const statusVariant: Record<string, "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  VERIFIED: "success",
};

function formatDateId(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T00:00:00+07:00`));
}

export default async function KinerjaHarianPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; dept?: string }>;
}) {
  const user = await requirePagePermission("performance.scorecards.view");
  const { tanggal, dept } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(tanggal ?? "") ? (tanggal as string) : jakartaToday();

  const depts = await listScorecardDepartments();
  const departmentId =
    dept && depts.some((d) => d.id === dept) ? dept : (depts[0]?.id ?? "");
  const branchId = user.branchId ?? (await defaultBranchId()) ?? "";

  const view = departmentId
    ? await getDailyScorecard(branchId, date, departmentId)
    : null;
  const month = monthRange(date);
  const recap = await listDailyScorecards(month.start, month.end);

  return (
    <div>
      <PageHeader
        title="Scorecard Harian"
        description={`${formatDateId(date)} · isi aktual harian, ajukan ke supervisor, verifikasi.`}
        actions={
          <div className="flex gap-2">
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

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form action="/kinerja/harian" method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="tanggal" className="text-xs font-medium text-muted-foreground">
                Tanggal
              </label>
              <input
                id="tanggal"
                type="date"
                name="tanggal"
                defaultValue={date}
                className="flex h-10 rounded-2xl bg-surface/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dept" className="text-xs font-medium text-muted-foreground">
                Departemen
              </label>
              <select
                id="dept"
                name="dept"
                defaultValue={departmentId}
                className="flex h-10 rounded-2xl bg-surface/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
          <p className="ml-auto text-xs text-muted-foreground">
            Baris berformula terisi otomatis dari data ERP (XLSX/APP/ORDER/COMPLAINT/STOCK).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{view?.departmentName ?? "Departemen"}</CardTitle>
                <CardDescription>
                  {formatDateId(date)}
                  {view ? ` · skor sementara ${view.totalScore}` : ""}
                </CardDescription>
              </div>
              {view && (
                <Badge variant={statusVariant[view.status] ?? "neutral"}>{view.status}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {view ? (
              <ScorecardForm
                key={`${view.departmentId}-${date}-${view.id ?? "new"}`}
                date={date}
                departmentId={view.departmentId}
                cardId={view.id}
                status={view.status}
                notes={view.notes ?? ""}
                lines={view.lines}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada departemen dengan indikator harian.</p>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Riwayat Bulan Ini</CardTitle>
            <CardDescription>Scorecard tersimpan {month.start.slice(0, 7)}.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead className="text-right">Skor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada scorecard bulan ini.
                    </TableCell>
                  </TableRow>
                )}
                {recap.slice(0, 30).map(({ card, departmentName }) => (
                  <TableRow key={card.id}>
                    <TableCell className="tabular-nums">
                      <Link
                        className="text-primary hover:underline"
                        href={`/kinerja/harian?tanggal=${card.date}&dept=${card.departmentId}`}
                      >
                        {card.date}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{departmentName}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{card.totalScore}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[card.status] ?? "neutral"}>{card.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <RefreshCwIcon className="h-3.5 w-3.5" /> Sinkronisasi KPI otomatis tiap pukul 23.59 WIB; tombol Sinkron di
        atas menjalankan hitung ulang sekarang.
      </p>
    </div>
  );
}
