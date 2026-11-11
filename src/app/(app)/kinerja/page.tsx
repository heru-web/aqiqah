import Link from "next/link";
import {
  BuildingIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  GaugeIcon,
  IdCardIcon,
  LineChartIcon,
  NetworkIcon,
  Settings2Icon,
  StoreIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getKinerjaSummary, getScopeGroups } from "@/server/services/performance";
import { getMonthlyReviewByPeriod } from "@/server/services/monthly-review";
import { listDailyScorecards, listWeeklyReviews } from "@/server/services/scorecards";
import { requirePagePermission } from "@/lib/server/page-auth";
import { SyncKpiButton } from "@/components/performance/sync-button";
import { ScoreTrendChart, type ScorePoint } from "@/components/performance/score-trend-chart";

const LEVEL_HREF: Record<string, string> = {
  COMPANY: "/kinerja/perusahaan",
  BUSINESS_UNIT: "/kinerja/unit-usaha",
  CHANNEL: "/kinerja/saluran",
  DEPARTMENT: "/kinerja/departemen",
  POSITION: "/kinerja/jabatan",
};

const LEVEL_ICON: Record<string, typeof GaugeIcon> = {
  COMPANY: LineChartIcon,
  BUSINESS_UNIT: BuildingIcon,
  CHANNEL: StoreIcon,
  DEPARTMENT: NetworkIcon,
  POSITION: IdCardIcon,
};

const unitLabel: Record<string, string> = {
  CURRENCY: "Rp",
  COUNT: "Jml",
  PERCENT: "%",
  RATIO: "Rasio",
  DURATION: "mnt",
  SCORE: "Skor",
};

const gradeVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "danger",
};

function fmt(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthShift(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function KinerjaPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const user = await requirePagePermission("performance.individual.view");
  const { periode } = await searchParams;
  const now = new Date();
  const defaultPeriod = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);
  const period = /^\d{4}-\d{2}$/.test(periode ?? "") ? (periode as string) : defaultPeriod;
  const range = periodRange(period);
  const prevPeriod = monthShift(period, -1);
  const prevRange = periodRange(prevPeriod);

  const [summary, prevGroups, history, cycles] = await Promise.all([
    getKinerjaSummary(range.start, range.end),
    getScopeGroups({ scope: "COMPANY", periodStart: prevRange.start, periodEnd: prevRange.end }),
    loadHistory(period),
    loadCycles(user.branchId, range),
  ]);

  const prevCompany = prevGroups[0] ?? null;
  const prevRowByInd = new Map((prevCompany?.rows ?? []).map((r) => [r.indicatorId, r]));
  const companyDelta =
    prevCompany && prevCompany.score !== null && prevCompany.score > 0 && summary.company.score !== null
      ? Math.round(((summary.company.score - prevCompany.score) / prevCompany.score) * 10000) / 100
      : null;

  return (
    <div>
      <PageHeader
        title="Dasbor Kinerja"
        description={`Ringkasan capaian KPI periode ${period} · skor 8 level manajemen.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SyncKpiButton />
            <Link href="/kinerja/pengaturan">
              <Button variant="outline">
                <Settings2Icon className="h-4 w-4" />
                Pengaturan KPI
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <form action="/kinerja" method="GET" className="flex items-end gap-2">
            <div className="space-y-1.5">
              <label htmlFor="periode" className="text-xs font-medium text-muted-foreground">
                Periode
              </label>
              <input
                id="periode"
                type="month"
                name="periode"
                defaultValue={period}
                className="flex h-10 w-full rounded-2xl bg-surface/70 px-3.5 py-2 text-sm text-foreground ring-1 ring-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
            <Button type="submit" variant="secondary">
              Tampilkan
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Link href="/kinerja/harian">
              <Button variant="ghost" size="sm">
                <CalendarCheckIcon className="h-4 w-4" />
                Scorecard Harian
              </Button>
            </Link>
            <Link href="/kinerja/mingguan">
              <Button variant="ghost" size="sm">
                <CalendarDaysIcon className="h-4 w-4" />
                Review Mingguan
              </Button>
            </Link>
            <Link href="/kinerja/bulanan">
              <Button variant="ghost" size="sm">
                <GaugeIcon className="h-4 w-4" />
                Review Bulanan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Skor Perusahaan · {period}
            </p>
            <div className="mt-3 flex items-end gap-3">
              <p className="font-display text-5xl font-bold text-foreground">{fmt(summary.company.score)}</p>
              {summary.company.grade ? (
                <Badge variant={gradeVariant[summary.company.grade]} className="mb-2">
                  Grade {summary.company.grade}
                </Badge>
              ) : (
                <Badge variant="neutral" className="mb-2">
                  Belum lengkap
                </Badge>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {companyDelta === null ? (
                <span className="text-xs text-muted-foreground">Belum ada pembanding bulan lalu</span>
              ) : (
                <Badge variant={companyDelta >= 0 ? "success" : "danger"}>
                  {companyDelta >= 0 ? "▲" : "▼"} {fmt(Math.abs(companyDelta))}%
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">vs {prevPeriod}</span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {summary.company.measured} dari {summary.company.total} indikator terukur periode ini.
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>6 KPI Perusahaan</CardTitle>
            <CardDescription>Capaian aktual terhadap target bulan berjalan.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summary.company.rows.map((r) => {
              const prev = prevRowByInd.get(r.indicatorId);
              const delta =
                prev && prev.actualValue !== null && r.actualValue !== null && prev.actualValue !== 0
                  ? Math.round(((r.actualValue - prev.actualValue) / Math.abs(prev.actualValue)) * 10000) / 100
                  : null;
              const improving = r.direction === "HIGHER_BETTER" ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0;
              return (
                <div key={r.indicatorId} className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{r.name}</p>
                  {r.actualValue === null ? (
                    <p className="mt-2 font-display text-xl font-bold text-muted-foreground">
                      {r.formulaKey ? "Menunggu data" : "—"}
                    </p>
                  ) : (
                    <p className="mt-2 font-display text-xl font-bold text-foreground">
                      {r.unit === "CURRENCY" && r.actualValue >= 1_000_000
                        ? `${fmt(Math.round(r.actualValue / 1_000_000))} jt`
                        : fmt(r.actualValue)}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        {unitLabel[r.unit] ?? ""}
                      </span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Target {fmt(r.targetValue)}</span>
                    {delta !== null && (
                      <Badge variant={improving ? "success" : "danger"}>
                        {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}%
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>8 Level Manajemen</CardTitle>
            <CardDescription>Skor tertimbang tiap level — klik baris untuk detail.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Skor</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Terukur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.levels.map((l, i) => {
                  const Icon = LEVEL_ICON[l.scope] ?? GaugeIcon;
                  const red = l.score !== null && l.score < 70;
                  return (
                    <TableRow key={l.scope} className={red ? "bg-danger/5" : undefined}>
                      <TableCell>
                        <Link href={LEVEL_HREF[l.scope]} className="flex items-center gap-2 font-medium text-foreground hover:text-primary">
                          <Icon className="h-4 w-4 text-primary" />
                          <span>
                            {i + 1}. {l.label}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(l.score)}</TableCell>
                      <TableCell>
                        {l.grade ? (
                          <Badge variant={gradeVariant[l.grade]}>{l.grade}</Badge>
                        ) : (
                          <Badge variant="neutral">Belum lengkap</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {l.measured}/{l.total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tren Skor Perusahaan</CardTitle>
            <CardDescription>Skor tertimbang 6 bulan terakhir.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={history} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Siklus Penilaian</CardTitle>
          <CardDescription>Status scorecard harian, review mingguan, dan review bulanan periode berjalan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/kinerja/harian"
            className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border transition hover:ring-primary/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scorecard Harian</p>
            <p className="mt-2 font-display text-xl font-bold text-foreground">{cycles.daily.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              skor periode ini · rata-rata {fmt(cycles.daily.avg)}
            </p>
          </Link>
          <Link
            href="/kinerja/mingguan"
            className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border transition hover:ring-primary/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Review Mingguan</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-display text-xl font-bold text-foreground">{cycles.weekly.total}</p>
              {cycles.weekly.latestStatus && (
                <Badge variant={cycles.weekly.latestStatus === "FINAL" ? "success" : "warning"}>
                  {cycles.weekly.latestStatus === "FINAL" ? "FINAL" : "DRAFT"}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">review tersimpan · terbaru {cycles.weekly.latestWeek ?? "—"}</p>
          </Link>
          <Link
            href="/kinerja/bulanan"
            className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border transition hover:ring-primary/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Review Bulanan</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-display text-xl font-bold text-foreground">{fmt(cycles.monthly.companyScore)}</p>
              {cycles.monthly.status && (
                <Badge
                  variant={
                    cycles.monthly.status === "APPROVED"
                      ? "success"
                      : cycles.monthly.status === "REVIEW"
                        ? "info"
                        : "warning"
                  }
                >
                  {cycles.monthly.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              skor perusahaan · {cycles.monthly.status ? cycles.monthly.periodStart : "belum dibuat"}
            </p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

async function loadHistory(period: string): Promise<ScorePoint[]> {
  const out: ScorePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const p = monthShift(period, -i);
    const r = periodRange(p);
    const groups = await getScopeGroups({ scope: "COMPANY", periodStart: r.start, periodEnd: r.end });
    out.push({ label: p.slice(2), score: groups[0]?.score ?? null });
  }
  return out;
}

async function loadCycles(
  branchId: string | null,
  range: { start: string; end: string }
): Promise<{
  daily: { total: number; avg: number };
  weekly: { total: number; latestStatus: string | null; latestWeek: string | null };
  monthly: { status: string | null; companyScore: number; periodStart: string };
}> {
  const [cards, weeklies, review] = await Promise.all([
    listDailyScorecards(range.start, range.end),
    listWeeklyReviews(4),
    branchId ? getMonthlyReviewByPeriod(branchId, range.start) : Promise.resolve(null),
  ]);
  const avg =
    cards.length > 0
      ? Math.round((cards.reduce((s, c) => s + Number(c.card.totalScore), 0) / cards.length) * 100) / 100
      : 0;
  return {
    daily: { total: cards.length, avg },
    weekly: {
      total: weeklies.length,
      latestStatus: weeklies[0]?.status ?? null,
      latestWeek: weeklies[0]?.weekStart ?? null,
    },
    monthly: {
      status: review?.review.status ?? null,
      companyScore: review ? Number(review.review.companyScore) : 0,
      periodStart: review?.review.periodStart ?? range.start,
    },
  };
}
