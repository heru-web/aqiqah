import Link from "next/link";
import { ArrowLeftIcon, TrendingDownIcon, TrendingUpIcon, MinusCircleIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { defaultBranchId } from "@/lib/server/auth";
import {
  currentWeekRange,
  getWeeklyReview,
  listWeeklyReviews,
  type WeeklyMetric,
} from "@/server/services/scorecards";
import { WeeklyEditor, type DecisionItem } from "@/components/performance/weekly-editor";

function fmtMetric(m: WeeklyMetric, v: number | null): string {
  if (v === null) return m.unit === "MODULE" ? "Menunggu modul" : "—";
  if (m.unit === "CURRENCY" || m.unit === "BALANCE")
    return `Rp ${Math.round(v).toLocaleString("id-ID")}`;
  if (m.unit === "PERCENT") return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString("id-ID");
}

function Delta({ metric }: { metric: WeeklyMetric }) {
  const { deltaPct } = metric;
  if (deltaPct === null || metric.unit === "MODULE")
    return (
      <Badge variant="neutral" className="gap-1">
        <MinusCircleIcon className="h-3 w-3" /> n/a
      </Badge>
    );
  const lowerIsBetter = metric.key === "complaints";
  const good = lowerIsBetter ? deltaPct < 0 : deltaPct > 0;
  const flat = deltaPct === 0;
  return (
    <Badge variant={flat ? "neutral" : good ? "success" : "danger"} className="gap-1">
      {flat ? (
        <MinusCircleIcon className="h-3 w-3" />
      ) : deltaPct > 0 ? (
        <TrendingUpIcon className="h-3 w-3" />
      ) : (
        <TrendingDownIcon className="h-3 w-3" />
      )}
      {deltaPct > 0 ? "+" : ""}
      {deltaPct}%
    </Badge>
  );
}

function formatDateId(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00+07:00`)
  );
}

export default async function KinerjaMingguanPage({
  searchParams,
}: {
  searchParams: Promise<{ minggu?: string }>;
}) {
  const user = await requirePagePermission("performance.weekly.view");
  const { minggu } = await searchParams;
  const def = currentWeekRange();
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(minggu ?? "") ? (minggu as string) : def.start;
  const branchId = user.branchId ?? (await defaultBranchId()) ?? "";

  const [{ review, weekEnd, prevStart, prevEnd, metrics, generatedAt }, history] = await Promise.all([
    getWeeklyReview(branchId, weekStart),
    listWeeklyReviews(8),
  ]);

  const decisions: DecisionItem[] = Array.isArray(review?.decisions)
    ? (review?.decisions as DecisionItem[]).map((d) => ({
        text: String(d.text ?? ""),
        owner: String(d.owner ?? ""),
        dueDate: String(d.dueDate ?? ""),
        done: Boolean(d.done),
      }))
    : [];

  const prevLabel = `${formatDateId(prevStart)} – ${formatDateId(prevEnd)}`;

  return (
    <div>
      <PageHeader
        title="Review Mingguan"
        description={`9 metrik utama · minggu ${formatDateId(weekStart)} – ${formatDateId(weekEnd)} · dibanding ${prevLabel}.`}
        actions={
          <Link href="/kinerja">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4" />
              Dasbor
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form action="/kinerja/mingguan" method="GET" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="minggu" className="text-xs font-medium text-muted-foreground">
                Mulai minggu (Senin)
              </label>
              <input
                id="minggu"
                type="date"
                name="minggu"
                defaultValue={weekStart}
                className="flex h-10 rounded-2xl bg-surface/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
          <p className="ml-auto text-xs text-muted-foreground">
            Terakhir dihitung {new Date(generatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
          </p>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.key}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <Delta metric={m} />
              </div>
              <p
                className={`mt-2 font-display text-xl font-bold ${
                  m.unit === "MODULE" ? "text-base text-muted-foreground" : "text-foreground"
                }`}
              >
                {fmtMetric(m, m.current)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.unit === "MODULE"
                  ? "Akan tampil setelah modul Produksi tersedia"
                  : `Minggu lalu: ${fmtMetric(m, m.previous)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 self-start">
          <CardHeader>
            <CardTitle>Hasil & Keputusan Review</CardTitle>
            <CardDescription>
              Ringkasan metrik tersimpan otomatis saat disimpan; action item diisi manual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyEditor
              key={weekStart}
              weekStart={weekStart}
              reviewId={review?.id ?? null}
              reviewStatus={review?.status ?? null}
              decisions={decisions}
            />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Riwayat Review</CardTitle>
            <CardDescription>8 minggu terakhir.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Minggu</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Belum ada review tersimpan.
                    </TableCell>
                  </TableRow>
                )}
                {history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        className="text-primary hover:underline"
                        href={`/kinerja/mingguan?minggu=${r.weekStart}`}
                      >
                        {formatDateId(r.weekStart)} – {formatDateId(r.weekEnd)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "FINAL" ? "success" : "neutral"}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
