import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDate, formatIDR } from "@/lib/utils";
import { RECEIVABLE_STATUSES, listReceivables } from "@/server/services/receivables";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Semua" },
  { value: "OPEN", label: "Belum Lunas" },
  { value: "PARTIAL", label: "Sebagian" },
  { value: "SETTLED", label: "Lunas" },
  { value: "BAD_DEBT", label: "Macet" },
];

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const user = await requirePagePermission("receivables.receivables.view");
  const sp = await searchParams;
  const status = RECEIVABLE_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const pageSize = Math.min(100, Math.max(1, Number(sp.pageSize ?? 25) || 25));
  const data = await listReceivables({
    branchId: user.branchId ?? undefined,
    status,
    page: Number(sp.page ?? 1) || 1,
    pageSize,
  });

  const buildHref = (page: number) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    p.set("page", String(page));
    return `/receivables?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Piutang"
        description="Piutang pelanggan per invoice jumlah sisa, jatuh tempo, dan status."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Outstanding", value: formatIDR(data.sumOutstanding) },
          { label: "Belum Lunas", value: data.statusCounts["OPEN"] ?? 0 },
          { label: "Sebagian", value: data.statusCounts["PARTIAL"] ?? 0 },
          { label: "Lunas", value: data.statusCounts["SETTLED"] ?? 0 },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-xl font-bold leading-none text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {STATUS_OPTIONS.map((o) => (
                <Link
                  key={o.value || "all"}
                  href={o.value ? `/receivables?status=${o.value}` : "/receivables"}
                  className={`rounded-full px-2.5 py-1 ring-1 transition-colors ${(status ?? "") === o.value ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground hover:text-foreground"}`}
                >
                  {o.label}
                </Link>
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {data.total} piutang · total outstanding {formatIDR(data.sumOutstanding)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-table-head text-table-head-fg">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.5px]">No. Invoice</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.5px]">Pelanggan</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-[0.5px]">Tagihan</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-[0.5px]">Dibayar</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-semibold uppercase tracking-[0.5px]">Sisa</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.5px]">Jatuh Tempo</th>
                  <th className="px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.5px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line-warm odd:bg-table-stripe transition-colors hover:bg-table-hover">
                    <td className="px-3 py-2.5 font-data text-xs">
                      {r.invoiceNumber ? (
                        <Link href={`/invoices/${r.invoiceId}`} className="text-primary underline-offset-2 hover:underline">
                          {r.invoiceNumber}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <p className="font-medium text-foreground">{r.customerName ?? "—"}</p>
                      {r.customerPhone && <p className="text-[11px] text-muted-foreground">{r.customerPhone}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-data tabular-nums">{formatIDR(r.amount)}</td>
                    <td className="px-3 py-2.5 text-right font-data tabular-nums text-muted-foreground">{formatIDR(r.paidAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-data tabular-nums font-semibold">{formatIDR(r.balance)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${r.status === "SETTLED" ? "bg-success/15 text-success-soft-foreground" : r.status === "PARTIAL" ? "bg-gold/15 text-gold-soft-foreground" : r.status === "OPEN" ? "bg-warning/15 text-warning-soft-foreground" : "bg-danger/15 text-danger-soft-foreground"}`}>
                        {STATUS_OPTIONS.find((o) => o.value === r.status)?.label ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Belum ada piutang pada filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-warm px-3 py-2.5">
            <span className="text-xs text-muted-foreground">
              Halaman {data.page}/{data.totalPages}
            </span>
            <div className="flex items-center gap-2">
              {data.page > 1 ? (
                <Link href={buildHref(data.page - 1)} className="rounded-lg px-2.5 py-1 text-xs ring-1 ring-line transition-colors hover:bg-surface-dim hover:text-foreground">‹ Sebelum</Link>
              ) : (
                <span className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground/50">‹ Sebelum</span>
              )}
              {data.page < data.totalPages ? (
                <Link href={buildHref(data.page + 1)} className="rounded-lg px-2.5 py-1 text-xs ring-1 ring-line transition-colors hover:bg-surface-dim hover:text-foreground">Berikut ›</Link>
              ) : (
                <span className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground/50">Berikut ›</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
