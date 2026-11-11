import { PageHeader } from "@/components/app/page-header";
import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { CreateQuotationDialog, type QuoteCustomer, type QuotePackage, type QuoteProduct } from "@/components/quotations/quotation-form-dialog";
import { listQuotations } from "@/server/services/quotations";
import { listCustomers } from "@/server/services/customers";
import { listProducts, listPackages } from "@/server/services/products";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableExportButtons } from "@/components/app/table-export";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePagePermission("quotations.quotations.view");
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const [{ rows, total }, { rows: customers }, products, packages] = await Promise.all([
    listQuotations({ branchId: user.branchId ?? undefined, page: pageNum, pageSize: 20 }),
    listCustomers({ branchId: user.branchId ?? undefined, pageSize: 500 }),
    listProducts({ activeOnly: true }),
    listPackages(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const quoteCustomers: QuoteCustomer[] = customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  const quoteProducts: QuoteProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    salePrice: p.salePrice.toString(),
  }));
  const quotePackages: QuotePackage[] = packages.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    discountBps: p.discountBps,
  }));

  return (
    <div>
      <PageHeader
        title="Penawaran"
        description="Penawaran untuk shohibul — bila disetujui langsung dibuatkan pesanan."
        actions={
          <CreateQuotationDialog customers={quoteCustomers} products={quoteProducts} packages={quotePackages} />
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="Belum ada penawaran" description="Buat penawaran harga untuk calon shohibul." />
      ) : (
        <Card>
          <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <span className="text-xs font-medium text-muted-foreground">{rows.length} penawaran</span>
            <div className="flex items-center gap-1.5">        <TableExportButtons
              filename="penawaran"
              columns={[
                { key: "quoteNumber", label: "No." },
                { key: "customer", label: "Pelanggan" },
                { key: "status", label: "Status" },
                { key: "total", label: "Total" },
                { key: "validUntil", label: "Berlaku s/d" },
              ]}
              rows={rows.map((q) => ({
                quoteNumber: q.quoteNumber,
                customer: q.customerName + (q.customerCode ? " (" + q.customerCode + ")" : ""),
                status: q.status ?? "",
                total: formatIDR(q.total),
                validUntil: q.validUntil ? formatDateTime(q.validUntil) : "",
              }))}
            /></div>
          </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Berlaku s/d</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-semibold text-primary">{q.quoteNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {q.customerName}
                      <p className="text-xs font-normal text-muted-foreground">{q.customerCode}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="quotation" status={q.status} />
                    </TableCell>
                    <TableCell className="text-right font-data">{formatIDR(q.total)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.validUntil ? formatDateTime(q.validUntil) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <QuotationActions id={q.id} status={q.status} />
                      </div>
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
              <Link href={`/quotations?page=${pageNum - 1}`}>
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </span>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Halaman {pageNum} dari {totalPages} · {total} penawaran
          </p>
          <Button variant="ghost" size="sm" disabled={pageNum >= totalPages} asChild={pageNum < totalPages}>
            {pageNum < totalPages ? (
              <Link href={`/quotations?page=${pageNum + 1}`}>
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