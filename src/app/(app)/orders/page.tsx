import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listOrders, orderCounts } from "@/server/services/orders";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { TableExportButtons } from "@/components/app/table-export";

const FILTERS = [
  "ALL",
  "DRAFT",
  "ORDER_CONFIRMED",
  "ANIMALS_SIAAP",
  "PACKED",
  "READY_DISPATCH",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const user = await requirePagePermission("orders.orders.view");
  const { q, status, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const statusFilter = (status as (typeof FILTERS)[number]) ?? "ALL";

  const counts = await orderCounts(user.branchId ?? undefined);
  const { rows, total, pageSize } = await listOrders({
    branchId: user.branchId ?? undefined,
    status: statusFilter,
    search: q,
    page: pageNum,
    pageSize: 20,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Pesanan"
        description="Pesanan aqiqah shohibul — dari draft sampai selesai."
        actions={
          <Link href="/orders/new">
            <Button>
              <PlusIcon className="h-4 w-4" /> Order Baru
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <Link key={f} href={`/orders?status=${f}${q ? `&q=${q}` : ""}`}>
                <Badge variant={statusFilter === f ? "primary" : "neutral"}>
                  {f === "ALL" ? "Semua" : ORDER_STATUS_LABELS[f]}
                  {f !== "ALL" && <span className="opacity-70"> {counts[f] ?? 0}</span>}
                </Badge>
              </Link>
            ))}
          </div>
          <form action="/orders" method="GET" className="mt-3 flex w-full items-center gap-2 sm:max-w-sm">
            <input type="hidden" name="status" value={statusFilter} />
            <Input name="q" defaultValue={q ?? ""} placeholder="Cari nomor order / shohibul…" />
            <Button type="submit" size="icon" aria-label="Cari">
              <SearchIcon className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan"
          description={q ? `Pencarian "${q}" tidak ditemukan.` : "Mulai buat order aqiqah pertama."}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
          <span className="text-xs font-medium text-muted-foreground">{rows.length} order</span>
          <div className="flex items-center gap-1.5"><TableExportButtons
              filename="pesanan"
              columns={[
                { key: "orderNumber", label: "No. Order" },
                { key: "shohibul", label: "Shohibul" },
                { key: "status", label: "Status" },
                { key: "total", label: "Total" },
                { key: "sisa", label: "Sisa" },
                { key: "pengiriman", label: "Pengiriman" },
              ]}
              rows={rows.map((r) => ({
                orderNumber: r.orderNumber,
                shohibul: r.shohibulName ?? r.customerName ?? "",
                status: r.status ?? "",
                total: formatIDR(r.total),
                sisa: r.balance > 0n ? formatIDR(r.balance) : "Lunas",
                pengiriman: r.deliveryDate ? formatDateTime(r.deliveryDate) : "",
              }))}
            /></div>
        </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Order</TableHead>
                  <TableHead>Shohibul</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Pengiriman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/orders/${r.id}`} className="font-semibold text-primary hover:underline">
                        {r.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground">{r.shohibulName ?? r.customerName}</TableCell>
                    <TableCell>
                      <StatusBadge kind="order" status={r.status} />
                    </TableCell>
                    <TableCell className="text-right font-data">{formatIDR(r.total)}</TableCell>
                    <TableCell className="text-right font-data">
                      {r.balance > 0n ? (
                        <span className="text-danger">{formatIDR(r.balance)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Lunas</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.deliveryDate ? formatDateTime(r.deliveryDate) : "—"}
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
              <Link href={`/orders?status=${statusFilter}&page=${pageNum - 1}${q ? `&q=${q}` : ""}`}>
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ChevronLeftIcon className="h-4 w-4" /> Sebelumnya
              </span>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Halaman {pageNum} dari {totalPages} · {total} order
          </p>
          <Button variant="ghost" size="sm" disabled={pageNum >= totalPages} asChild={pageNum < totalPages}>
            {pageNum < totalPages ? (
              <Link href={`/orders?status=${statusFilter}&page=${pageNum + 1}${q ? `&q=${q}` : ""}`}>
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