import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getScopeGroups, listPositions } from "@/server/services/performance";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { sql } from "drizzle-orm";
import { fmtNum } from "@/components/performance/scope-group-card";

function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

const gradeVariant: Record<string, "success" | "info" | "warning" | "danger"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "danger",
};

export default async function KinerjaJabatanPage({
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

  const [groups, positions, headcounts] = await Promise.all([
    getScopeGroups({ scope: "POSITION", periodStart: range.start, periodEnd: range.end }),
    listPositions(),
    db
      .select({ positionId: employees.positionId, n: sql<number>`count(*)::int` })
      .from(employees)
      .where(sql`${employees.deletedAt} is null and ${employees.status} <> 'RESIGN'`)
      .groupBy(employees.positionId),
  ]);

  const countByPosition = new Map(headcounts.map((h) => [h.positionId, h.n]));
  const nameByPosition = new Map(positions.map((p) => [p.pos.id, p.pos.name]));
  const allPositions = [...nameByPosition.keys()];
  const covered = new Set(groups.map((g) => g.refId));

  return (
    <div>
      <PageHeader
        title="Kinerja Jabatan"
        description={`Skor per jabatan (turunan KPI departemen) · periode ${period}.`}
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
          <form action="/kinerja/jabatan" method="GET" className="flex items-end gap-2">
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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Rekap Jabatan</CardTitle>
          <CardDescription>Jumlah orang, skor rata-rata, dan grade tiap jabatan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead className="text-right">Orang</TableHead>
                <TableHead className="text-right">Indikator</TableHead>
                <TableHead className="text-right">Skor</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPositions.map((posId) => {
                const g = groups.find((x) => x.refId === posId);
                const pos = positions.find((p) => p.pos.id === posId);
                return (
                  <TableRow key={posId}>
                    <TableCell className="font-semibold text-primary">{pos?.pos.code ?? "—"}</TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{nameByPosition.get(posId) ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{pos?.deptName ?? ""}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{countByPosition.get(posId) ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {g ? `${g.measured}/${g.total}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {g && covered.has(posId) ? fmtNum(g.score) : fmtNum(null)}
                    </TableCell>
                    <TableCell>
                      {g && covered.has(posId) ? (
                        g.grade ? (
                          <Badge variant={gradeVariant[g.grade]}>{g.grade}</Badge>
                        ) : (
                          <Badge variant="neutral">Belum lengkap</Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada target</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.refId ?? g.refName}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{g.refName}</p>
                  <p className="text-xs text-muted-foreground">
                    {countByPosition.get(g.refId ?? "") ?? 0} orang · {g.measured}/{g.total} indikator terukur
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-bold text-foreground">{fmtNum(g.score)}</span>
                  {g.grade ? (
                    <Badge variant={gradeVariant[g.grade]}>{g.grade}</Badge>
                  ) : (
                    <Badge variant="neutral">Belum lengkap</Badge>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {g.rows.map((r) => (
                  <div key={r.indicatorId} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {r.actualValue === null ? "—" : fmtNum(r.actualValue)} / {fmtNum(r.targetValue)}
                      </span>
                      <Badge variant={r.score === null ? "neutral" : r.score >= 90 ? "success" : r.score >= 70 ? "info" : "danger"}>
                        {r.score === null ? "—" : fmtNum(r.score)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {g.rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada target jabatan ini.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
