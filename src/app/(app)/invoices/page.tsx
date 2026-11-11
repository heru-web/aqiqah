import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { listInvoices } from "@/server/services/invoices";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { INVOICE_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableExportButtons } from "@/components/app/table-export";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const statuses = ["ALL", "DRAFT", "ISSUED", "PARTIAL", "PAID", "VOID", "BAD_DEBT"] as const;
type Filter = (typeof statuses)[number];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePagePermission("invoices.invoices.view");
  const { status, page } = await searchParams;
  const filter: Filter = statuses.includes(status as Filter) ? (status as Filter) : "ALL";
  const pageNum = Math.max(1, Number(page) || 1);
  const { rows, total, page: _sp, pageSize } = await listInvoices({ branchId: user.branchId ?? undefined, status: filter, page: pageNum, pageSize: 20 });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Tagihan"
        description="Tagihan yang diterbitkan otomatis dari pesanan."
        actions={null}
      />

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {statuses.map((s) => (
          <Badge key={s} variant={filter === s ? "primary" : "neutral"}>
            <a href={`/invoices?status=${s}`}>{s === "ALL" ? "Semua" : (INVOICE_STATUS_LABELS[s] ?? s)}</a>
          </Badge>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada tagihan" description="Tagihan dibuat otomatis saat pesanan dikonfirmasi." />
      ) : (
        <Card>
          <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
          <span className="text-xs font-medium text-muted-foreground">{rows.length} invoice</span>
          <div className="flex items-center gap-1.5"><TableExportButtons
              filename="tagihan"
              columns={[
                { key: "invoiceNumber", label: "No. Invoice" },
                { key: "status", label: "Status" },
                { key: "total", label: "Total" },
                { key: "dibayar", label: "Dibayar" },
                { key: "sisa", label: "Sisa" },
                { key: "dueDate", label: "Jatuh Tempo" },
              ]}
              rows={rows.map((inv) => ({
                invoiceNumber: inv.invoiceNumber,
                status: inv.status ?? "",
                total: formatIDR(inv.total),
                dibayar: formatIDR(inv.totalPaid),
                sisa: inv.balance > 0n ? formatIDR(inv.balance) : "Lunas",
                dueDate: inv.dueDate ? formatDateTime(inv.dueDate) : "",
              }))}
            /></div>
        </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>No. Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Dibayar</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-semibold text-primary">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.orderId ? <a href={`/orders/${inv.orderId}`} className="text-primary hover:underline">Lihat order</a> : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="invoice" status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right font-data">{formatIDR(inv.total)}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(inv.totalPaid)}</TableCell>
                    <TableCell className="text-right font-data">
                      {inv.balance > 0n ? (
                        <span className="text-danger">{formatIDR(inv.balance)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Lunas</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{inv.dueDate ? formatDateTime(inv.dueDate) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={pageNum <= 1} asChild={pageNum > 1}>
            {pageNum > 1 ? (
              <Link href={`/invoices?status=${filter}&page=${pageNum - 1}`}>
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </span>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Halaman {pageNum} dari {totalPages} · {total} invoice
          </p>
          <Button variant="ghost" size="sm" disabled={pageNum >= totalPages} asChild={pageNum < totalPages}>
            {pageNum < totalPages ? (
              <Link href={`/invoices?status=${filter}&page=${pageNum + 1}`}>
                Berikutnya <ChevronRightIcon className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                Berikutnya <ChevronRightIcon className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}