"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableColumn } from "@/components/app/data-table";

type Row = {
  id: string;
  supplierName: string | null;
  amount: string;
  paidAmount: string;
  balance: string;
  dueAt: string | null;
  status: string;
};

export function PayablesTable({ payables }: { payables: Row[] }) {
  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: "supplier", header: "Supplier", cell: (r: Row) => r.supplierName ?? "-" },
      { key: "amount", header: "Tagihan", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.amount || 0).toLocaleString("id-ID")}</span> },
      { key: "paid", header: "Dibayar", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.paidAmount || 0).toLocaleString("id-ID")}</span> },
      { key: "balance", header: "Sisa", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.balance || 0).toLocaleString("id-ID")}</span> },
      { key: "due", header: "Jatuh Tempo", cell: (r: Row) => (r.dueAt ? new Date(r.dueAt).toLocaleDateString("id-ID") : "-") },
      { key: "status", header: "Status", cell: (r: Row) => r.status },
    ],
    []
  );

  return (
    <div>
      <PageHeader title="Hutang" description="Daftar hutang usaha per faktur pembelian." />
      <Card>
        <CardContent className="p-0">
          <DataTable
          columns={columns}
          rows={payables}
          rowKey={(r: Row) => r.id}
          emptyTitle="Belum ada hutang"
          exportable={{
            filename: "hutang",
            columns: [
              { key: "supplierName", label: "Pemasok" },
              { key: "status", label: "Status" },
              { key: "amount", label: "Total" },
              { key: "paidAmount", label: "Dibayar" },
              { key: "balance", label: "Sisa" },
              { key: "dueAt", label: "Jatuh Tempo" },
            ],
            map: (r: Row) => ({ supplierName: r.supplierName ?? "", status: r.status ?? "", amount: r.amount, paidAmount: r.paidAmount, balance: r.balance, dueAt: r.dueAt ?? "" }),
            sheetName: "Hutang",
          }}
        />
        </CardContent>
      </Card>
    </div>
  );
}
