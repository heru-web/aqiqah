import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScopeGroup } from "@/server/services/performance";

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

export function fmtNum(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/** Tabel baris KPI satu grup cakupan (dipakai halaman level). */
export function ScopeGroupCard({
  group,
  description,
  compact,
}: {
  group: ScopeGroup;
  description?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {group.refName}
            {group.refCode && (
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.refCode}</span>
            )}
          </CardTitle>
          <CardDescription>
            {description ?? `${group.measured}/${group.total} indikator terukur`}
            {group.grade === null && group.total > 0 ? " · cakupan belum cukup untuk dinilai" : ""}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-foreground">{fmtNum(group.score)}</span>
          {group.grade ? (
            <Badge variant={gradeVariant[group.grade]}>{group.grade}</Badge>
          ) : (
            <Badge variant="neutral">Belum lengkap</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indikator</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Aktual</TableHead>
              <TableHead className="text-right">Skor</TableHead>
              {!compact && <TableHead className="text-right">Bobot</TableHead>}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={compact ? 5 : 6} className="text-center text-muted-foreground">
                  Belum ada target indikator pada periode ini.
                </TableCell>
              </TableRow>
            ) : (
              group.rows.map((r) => (
                <TableRow key={r.indicatorId}>
                  <TableCell>
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.code} · {unitLabel[r.unit] ?? r.unit} · {r.frequency === "DAILY" ? "harian" : r.frequency === "WEEKLY" ? "mingguan" : "bulanan"}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.targetValue)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.actualValue === null ? (
                      <span className="text-muted-foreground">
                        {r.formulaKey ? "Menunggu data" : "Input manual"}
                      </span>
                    ) : (
                      fmtNum(r.actualValue)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.score === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={r.score >= 90 ? "success" : r.score >= 70 ? "info" : "danger"}>{fmtNum(r.score)}</Badge>
                    )}
                  </TableCell>
                  {!compact && <TableCell className="text-right tabular-nums">{fmtNum(r.weight)}</TableCell>}
                  <TableCell>
                    {r.actualStatus ? (
                      <Badge variant={r.actualStatus === "VERIFIED" ? "success" : r.actualStatus === "SUBMITTED" ? "info" : "neutral"}>
                        {r.actualStatus}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada data</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
