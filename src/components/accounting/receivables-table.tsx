"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/app/data-table";

type Row = {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerName: string | null;
  amount: string;
  paidAmount: string;
  balance: string;
  dueAt: string | null;
  status: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  OPEN: { label: "Belum Lunas", variant: "warning" },
  PARTIAL: { label: "Sebagian", variant: "gold" },
  PAID: { label: "Lunas", variant: "success" },
  WRITTEN_OFF: { label: "Dihapuskan", variant: "neutral" },
};

export function ReceivablesTable({ receivables }: { receivables: Row[] }) {
  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: "invoice", header: "No. Invoice", cell: (r: Row) => <span className="font-mono text-xs">{r.invoiceNumber ?? "-"}</span> },
      { key: "customer", header: "Pelanggan", cell: (r: Row) => r.customerName ?? "-" },
      { key: "amount", header: "Tagihan", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.amount || 0).toLocaleString("id-ID")}</span> },
      { key: "paid", header: "Dibayar", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.paidAmount || 0).toLocaleString("id-ID")}</span> },
      { key: "balance", header: "Sisa", cell: (r: Row) => <span className="tabular-nums font-medium">Rp {Number(r.balance || 0).toLocaleString("id-ID")}</span> },
      { key: "due", header: "Jatuh Tempo", cell: (r: Row) => (r.dueAt ? new Date(r.dueAt).toLocaleDateString("id-ID") : "-") },
      { key: "status", header: "Status", cell: (r: Row) => {
        const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "neutral" };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      } },
    ],
    []
  );

  return (
    <div>
      <PageHeader title="Piutang" description="Daftar piutang pelanggan per invoice." />
      <Card>
        <CardContent className="p-0">
          <DataTable
          columns={columns}
          rows={receivables}
          rowKey={(r: Row) => r.id}
          emptyTitle="Belum ada piutang"
          exportable={{
            filename: "piutang",
            columns: [
              { key: "invoiceNumber", label: "No. Invoice" },
              { key: "customerName", label: "Pelanggan" },
              { key: "amount", label: "Total" },
              { key: "paidAmount", label: "Dibayar" },
              { key: "balance", label: "Sisa" },
              { key: "dueAt", label: "Jatuh Tempo" },
            ],
            map: (r: Row) => ({ invoiceNumber: r.invoiceNumber ?? "", customerName: r.customerName ?? "", status: r.status ?? "", amount: r.amount, paidAmount: r.paidAmount, balance: r.balance, dueAt: r.dueAt ?? "" }),
            sheetName: "Piutang",
          }}
        />
        </CardContent>
      </Card>
    </div>
  );
}
