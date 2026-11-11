import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PaymentConfirmActions } from "@/components/payments/payment-confirm-actions";
import { listPayments } from "@/server/services/payments";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableExportButtons } from "@/components/app/table-export";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const statuses = ["ALL", "PENDING", "CONFIRMED", "FAILED", "REVERSED"] as const;
type Filter = (typeof statuses)[number];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePagePermission("payments.payments.view");
  const { status, page } = await searchParams;
  const filter: Filter = statuses.includes(status as Filter) ? (status as Filter) : "ALL";
  const pageNum = Math.max(1, Number(page) || 1);
  const { rows, total, page: _sp, pageSize } = await listPayments({ branchId: user.branchId ?? undefined, status: filter, page: pageNum, pageSize: 20 });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Pembayaran"
        description="Catatan pembayaran — konfirmasi memicu jurnal otomatis & pelunasan tagihan."
        actions={null}
      />

      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        {statuses.map((s) => (
          <Badge key={s} variant={filter === s ? "primary" : "neutral"}>
            <a href={`/payments?status=${s}`}>{s === "ALL" ? "Semua" : (PAYMENT_STATUS_LABELS[s] ?? s)}</a>
          </Badge>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada pembayaran" description="Pembayaran tercatat otomatis dari wizard atau webhook BSI." />
      ) : (
        <Card>
          <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
          <span className="text-xs font-medium text-muted-foreground">{rows.length} pembayaran</span>
          <div className="flex items-center gap-1.5"><TableExportButtons
              filename="pembayaran"
              columns={[
                { key: "paymentNumber", label: "No." },
                { key: "method", label: "Metode" },
                { key: "status", label: "Status" },
                { key: "amount", label: "Nominal" },
                { key: "referensi", label: "Referensi" },
                { key: "createdAt", label: "Waktu" },
              ]}
              rows={rows.map((p) => ({
                paymentNumber: p.paymentNumber,
                method: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
                status: p.status ?? "",
                amount: formatIDR(p.amount),
                referensi: (p.providerRef ?? "") + (p.senderName ? " / " + p.senderName : ""),
                createdAt: formatDateTime(p.createdAt),
              }))}
            /></div>
        </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Referensi</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold text-primary">{p.paymentNumber}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</Badge>
                      {p.provider && <p className="mt-0.5 text-xs text-muted-foreground">{p.provider}</p>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="payment" status={p.status} />
                    </TableCell>
                    <TableCell className="text-right font-data">{formatIDR(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.providerRef ?? p.paymentNumber}
                      {p.senderName && <p className="text-xs">dari {p.senderName}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                    <TableCell>
                      <PaymentConfirmActions id={p.id} status={p.status} />
                    </TableCell>
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
              <Link href={`/payments?status=${filter}&page=${pageNum - 1}`}>
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </span>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Halaman {pageNum} dari {totalPages} · {total} pembayaran
          </p>
          <Button variant="ghost" size="sm" disabled={pageNum >= totalPages} asChild={pageNum < totalPages}>
            {pageNum < totalPages ? (
              <Link href={`/payments?status=${filter}&page=${pageNum + 1}`}>
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