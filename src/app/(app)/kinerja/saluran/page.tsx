import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getScopeGroups } from "@/server/services/performance";
import { listSalesChannels } from "@/server/services/performance";
import { ScopeGroupCard, fmtNum } from "@/components/performance/scope-group-card";

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default async function KinerjaSaluranPage({
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

  const [groups, channels] = await Promise.all([
    getScopeGroups({ scope: "CHANNEL", periodStart: range.start, periodEnd: range.end }),
    listSalesChannels(),
  ]);
  const typeByRef = new Map(channels.map((c) => [c.id, c.type]));

  const online = groups.filter((g) => typeByRef.get(g.refId ?? "") === "ONLINE");
  const offline = groups.filter((g) => typeByRef.get(g.refId ?? "") === "OFFLINE");
  const avg = (list: typeof groups) => {
    // Rata-rata hanya dari grup yang benar-benar punya skor (cakupan cukup).
    const scored = list.filter((g) => g.score !== null);
    if (scored.length === 0) return null;
    return Math.round((scored.reduce((s, g) => s + (g.score ?? 0), 0) / scored.length) * 100) / 100;
  };

  return (
    <div>
      <PageHeader
        title="Kinerja Saluran Penjualan"
        description={`Online vs Offline · 9 saluran · periode ${period}.`}
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
          <form action="/kinerja/saluran" method="GET" className="flex items-end gap-2">
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

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rata-rata Online</p>
              <Badge variant="info">ONLINE</Badge>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{fmtNum(avg(online))}</p>
            <p className="mt-1 text-xs text-muted-foreground">{online.length} saluran · WA, Social, Marketplace, Ads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rata-rata Offline</p>
              <Badge variant="warning">OFFLINE</Badge>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{fmtNum(avg(offline))}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {offline.length} saluran · Canvas, Resto, B2B, Partnership, Event
            </p>
          </CardContent>
        </Card>
      </div>

      {(["ONLINE", "OFFLINE"] as const).map((t) => {
        const list = t === "ONLINE" ? online : offline;
        return (
          <section key={t} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Saluran {t === "ONLINE" ? "Online" : "Offline"}
              </h2>
              <Badge variant={t === "ONLINE" ? "info" : "warning"}>{t}</Badge>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada target saluran {t.toLowerCase()} periode ini.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {list.map((g) => (
                  <ScopeGroupCard key={g.refId ?? g.refName} group={g} description={`Saluran ${g.refName}`} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
