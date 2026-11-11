import Link from "next/link";
import { TableExportButtons } from "@/components/app/table-export";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { listAuditLogs } from "@/server/services/settings";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  await requirePagePermission("audit.audit.view");
  const { module } = await searchParams;
  const rows = await listAuditLogs({ module: module === "ALL" || !module ? undefined : module, pageSize: 100 });

  return (
    <div>
      <PageHeader title="Log Audit" description="Jejak perubahan seluruh modul — tidak bisa diedit." actions={null} />

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <Badge variant={!module || module === "ALL" ? "primary" : "neutral"}>
          <Link href="/audit">Semua</Link>
        </Badge>
        {["orders", "customers", "leads", "quotations", "invoices", "payments", "users", "roles", "branches", "settings"].map((m) => (
          <Badge key={m} variant={module === m ? "primary" : "neutral"}>
            <Link href={`/audit?module=${m}`}>{m}</Link>
          </Badge>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada jejak" description="Aktivitas perubahan akan tercatat otomatis." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{rows.length} jejak{module && module !== "ALL" ? ` · modul ${module}` : ""}</span>
              <TableExportButtons
                filename={`audit-${(module ?? "all").toLowerCase()}`}
                columns={[
                  { key: "waktu", label: "Waktu" },
                  { key: "module", label: "Modul" },
                  { key: "action", label: "Aksi" },
                  { key: "entityType", label: "Entitas" },
                  { key: "entityId", label: "ID" },
                  { key: "actor", label: "Oleh" },
                ]}
                rows={rows.map((a) => ({
                  waktu: formatDateTime(a.createdAt),
                  module: a.module,
                  action: a.action,
                  entityType: a.entityType,
                  entityId: a.entityId,
                  actor: a.actorUserId ? a.actorUserId.slice(0, 8) : "sistem",
                }))}
                sheetName="Audit"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Modul</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead>Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{a.module}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.action === "DELETE" ? "danger" : "neutral"}>{a.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.entityType}
                      <span className="ml-1 font-data">{a.entityId}</span>
                      <p className="whitespace-pre-line">{a.after ? JSON.stringify(a.after).slice(0, 120) : ""}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.actorUserId ? a.actorUserId.slice(0, 8) : "sistem"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}