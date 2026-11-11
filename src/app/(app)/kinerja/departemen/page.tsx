import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/server/page-auth";
import { getScopeGroups, listDepartments } from "@/server/services/performance";
import { ScopeGroupCard, fmtNum } from "@/components/performance/scope-group-card";

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

export default async function KinerjaDepartemenPage({
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

  const [monthlyGroups, allGroups, depts] = await Promise.all([
    getScopeGroups({ scope: "DEPARTMENT", periodStart: range.start, periodEnd: range.end, includeDaily: false }),
    getScopeGroups({ scope: "DEPARTMENT", periodStart: range.start, periodEnd: range.end }),
    listDepartments(),
  ]);

  const deptById = new Map(depts.map((d) => [d.dept.id, d]));
  const parents = depts.filter((d) => !d.dept.parentDepartmentId).sort((a, b) => a.dept.sortOrder - b.dept.sortOrder);

  return (
    <div>
      <PageHeader
        title="Kinerja Departemen"
        description={`Skor 4 departemen induk + sub-unit · periode ${period}.`}
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
          <form action="/kinerja/departemen" method="GET" className="flex items-end gap-2">
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {parents.map((p) => {
          const g = monthlyGroups.find((x) => x.refId === p.dept.id);
          const children = allGroups.filter((x) => {
            const meta = deptById.get(x.refId ?? "");
            return meta && meta.dept.parentDepartmentId === p.dept.id;
          });
          const scoredChildren = children.filter((c) => c.score !== null);
          const childAvg =
            scoredChildren.length > 0
              ? Math.round((scoredChildren.reduce((s, c) => s + (c.score ?? 0), 0) / scoredChildren.length) * 100) / 100
              : null;
          return (
            <Card key={p.dept.id}>
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.dept.name}</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="font-display text-2xl font-bold text-foreground">{fmtNum(g?.score ?? null)}</p>
                  {g?.grade ? (
                    <Badge variant={gradeVariant[g.grade]} className="mb-1">{g.grade}</Badge>
                  ) : g ? (
                    <Badge variant="neutral" className="mb-1">Belum lengkap</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {g ? `${g.measured}/${g.total} indikator bulanan` : "Belum ada target bulanan"}
                </p>
                {childAvg !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">Sub-unit: {fmtNum(childAvg)} rata-rata</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {monthlyGroups.map((g) => (
          <ScopeGroupCard key={g.refId ?? g.refName} group={g} description={`Departemen ${g.refName} · KPI bulanan`} />
        ))}
        {monthlyGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada target KPI bulanan departemen periode ini.</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skor Seluruh Departemen & Sub-unit</CardTitle>
          <CardDescription>Termasuk indikator harian (dirata-ratakan per hari).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departemen</TableHead>
                <TableHead>Induk</TableHead>
                <TableHead>Unit Usaha</TableHead>
                <TableHead className="text-right">Indikator</TableHead>
                <TableHead className="text-right">Skor</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parents.flatMap((p) => {
                const rows: Array<React.ReactNode> = [];
                const own = allGroups.find((x) => x.refId === p.dept.id);
                rows.push(
                  <TableRow key={p.dept.id}>
                    <TableCell className="font-medium text-foreground">{p.dept.name}</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">{p.buName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {own ? `${own.measured}/${own.total}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtNum(own?.score ?? null)}</TableCell>
                    <TableCell>
                      {own?.grade ? (
                        <Badge variant={gradeVariant[own.grade]}>{own.grade}</Badge>
                      ) : own ? (
                        <Badge variant="neutral">Belum lengkap</Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
                for (const c of allGroups.filter((x) => {
                  const meta = deptById.get(x.refId ?? "");
                  return meta && meta.dept.parentDepartmentId === p.dept.id;
                })) {
                  const meta = deptById.get(c.refId ?? "");
                  rows.push(
                    <TableRow key={c.refId ?? c.refName} className="bg-surface/40">
                      <TableCell className="pl-8 text-foreground">{c.refName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.dept.name}</TableCell>
                      <TableCell className="text-muted-foreground">{meta?.buName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.measured}/{c.total}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtNum(c.score)}</TableCell>
                      <TableCell>
                        {c.grade ? (
                          <Badge variant={gradeVariant[c.grade]}>{c.grade}</Badge>
                        ) : (
                          <Badge variant="neutral">Belum lengkap</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }
                return rows;
              })}
              {allGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada target departemen periode ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
