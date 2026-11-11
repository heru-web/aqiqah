import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getScopeGroups } from "@/server/services/performance";
import { ScopeGroupCard, fmtNum } from "@/components/performance/scope-group-card";
import { ScoreTrendChart, type ScorePoint } from "@/components/performance/score-trend-chart";
import { SyncKpiButton } from "@/components/performance/sync-button";

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

export default async function KinerjaPerusahaanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePagePermission("performance.individual.view");
  const { periode } = await searchParams;
  const now = new Date();
  const defaultPeriod = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
  const period = /^\d{4}-\d{2}$/.test(periode ?? "") ? (periode as string) : defaultPeriod;
  const range = periodRange(period);

  const groups = await getScopeGroups({ scope: "COMPANY", periodStart: range.start, periodEnd: range.end });
  const group = groups[0];

  const history: ScorePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const p = monthShift(period, -i);
    const r = periodRange(p);
    const g = await getScopeGroups({ scope: "COMPANY", periodStart: r.start, periodEnd: r.end });
    history.push({ label: p.slice(2), score: g[0]?.score ?? null });
  }

  return (
    <div>
      <PageHeader
        title="Kinerja Perusahaan"
        description={`6 KPI level perusahaan · periode ${period}.`}
        actions={
          <div className="flex items-center gap-2">
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
        <CardContent className="flex items-end gap-3 p-4">
          <form action="/kinerja/perusahaan" method="GET" className="flex items-end gap-2">
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
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tren Skor 6 Bulan</CardTitle>
            <CardDescription>Skor tertimbang KPI perusahaan per bulan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={history} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ringkas</CardTitle>
            <CardDescription>Capaian periode berjalan.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Skor</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{fmtNum(group?.score ?? null)}</p>
            </div>
            <div className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Terukur</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {group?.measured ?? 0}
                <span className="text-base text-muted-foreground">/{group?.total ?? 0}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grade</p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{group?.grade ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {group && <ScopeGroupCard group={group} description={`KPI perusahaan ${period}`} />}
    </div>
  );
}
