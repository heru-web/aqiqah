import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getScopeGroups } from "@/server/services/performance";
import { ScopeGroupCard, fmtNum } from "@/components/performance/scope-group-card";
import { NamedBarChart } from "@/components/performance/named-bar-chart";

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default async function KinerjaUnitUsahaPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; unit?: string }>;
}) {
  await requirePagePermission("performance.individual.view");
  const { periode, unit } = await searchParams;
  const now = new Date();
  const defaultPeriod = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" })
    .format(now)
    .slice(0, 7);
  const period = /^\d{4}-\d{2}$/.test(periode ?? "") ? (periode as string) : defaultPeriod;
  const range = periodRange(period);
  const unitId = unit && /^[0-9a-f-]{36}$/i.test(unit) ? unit : null;

  const groups = await getScopeGroups({
    scope: "BUSINESS_UNIT",
    periodStart: range.start,
    periodEnd: range.end,
    refIds: unitId ? [unitId] : undefined,
  });

  const revenueBars = groups.map((g) => ({
    label: g.refName,
    value: g.rows.find((r) => r.code === "BU_REVENUE")?.actualValue ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Kinerja Unit Usaha"
        description={`Perbandingan 4 unit (Aqiqah, Qurban, Catering, BumbuNesia) · periode ${period}.`}
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
        <CardContent className="flex items-end gap-2 p-4">
          <form action="/kinerja/unit-usaha" method="GET" className="flex items-end gap-2">
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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <Link key={g.refId ?? g.refName} href={`/kinerja/unit-usaha?periode=${period}&unit=${g.refId ?? ""}`}>
            <div className="rounded-2xl bg-surface/60 p-4 ring-1 ring-border transition hover:ring-primary/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.refName}</p>
              <p className="mt-2 font-display text-xl font-bold text-foreground">{fmtNum(g.score)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.grade ? `Grade ${g.grade}` : "Belum lengkap"} · {g.measured}/{g.total} terukur
              </p>
            </div>
          </Link>
        ))}
        {groups.length === 0 && (
          <p className="col-span-4 text-sm text-muted-foreground">Belum ada target unit usaha pada periode ini.</p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kontribusi Pendapatan</CardTitle>
            <CardDescription>Pendapatan aktual per unit (Rp).</CardDescription>
          </CardHeader>
          <CardContent>
            <NamedBarChart data={revenueBars} name="Pendapatan" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Peringkat Unit</CardTitle>
            <CardDescription>Skor tertimbang tiap unit.</CardDescription>
          </CardHeader>
          <CardContent>
            <NamedBarChart data={[...groups].map((g) => ({ label: g.refName, value: g.score }))} name="Skor" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {groups.map((g) => (
          <ScopeGroupCard key={g.refId ?? g.refName} group={g} description={`Unit ${g.refName} · ${period}`} />
        ))}
      </div>
    </div>
  );
}
