"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/app/data-table";
import { reverseJournalFormAction } from "@/server/actions/journals";

type Row = {
  id: string;
  journalNumber: string;
  journalDate: string;
  type: string;
  status: string;
  description: string;
  debitTotal: string;
  creditTotal: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  POSTED: { label: "Terposting", variant: "success" },
  REVERSED: { label: "Dibalik", variant: "danger" },
};

export function JournalsTable({ journals }: { journals: Row[] }) {
  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: "no", header: "No. Jurnal", cell: (r: Row) => <span className="font-mono text-xs">{r.journalNumber}</span> },
      { key: "date", header: "Tanggal", cell: (r: Row) => new Date(r.journalDate).toLocaleDateString("id-ID") },
      { key: "type", header: "Tipe", cell: (r: Row) => <Badge variant="neutral">{r.type}</Badge> },
      { key: "desc", header: "Keterangan", cell: (r: Row) => <span className="line-clamp-1 max-w-[320px] text-sm">{r.description}</span> },
      { key: "debit", header: "Debit", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.debitTotal || 0).toLocaleString("id-ID")}</span> },
      { key: "credit", header: "Kredit", cell: (r: Row) => <span className="tabular-nums">Rp {Number(r.creditTotal || 0).toLocaleString("id-ID")}</span> },
      { key: "status", header: "Status", cell: (r: Row) => {
        const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "neutral" };
        return <Badge variant={s.variant}>{s.label}</Badge>;
      } },
      { key: "aksi", header: "Aksi", cell: (r: Row) =>
        r.status !== "POSTED" ? <span className="text-xs text-muted-foreground">—</span> : (
          <form
            action={reverseJournalFormAction}
            onSubmit={(e) => {
              if (!confirm(`Balik jurnal ${r.journalNumber}? Jurnal lawan otomatis dibuat.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="rounded-lg px-2 py-1 text-xs text-muted-foreground ring-1 ring-line transition-colors hover:bg-danger-soft hover:text-danger-soft-foreground">
              Balik
            </button>
          </form>
        ) },
    ],
    []
  );

  return (
    <div>
      <PageHeader title="Akuntansi" description="Daftar jurnal umum & otomatis." />
      <Card>
        <CardContent className="p-0">
          <DataTable
          columns={columns}
          rows={journals}
          rowKey={(r: Row) => r.id}
          emptyTitle="Belum ada jurnal"
          exportable={{
            filename: "jurnal",
            columns: [
              { key: "journalNumber", label: "No. Jurnal" },
              { key: "journalDate", label: "Tanggal" },
              { key: "description", label: "Deskripsi" },
              { key: "debitTotal", label: "Debit" },
              { key: "creditTotal", label: "Kredit" },
            ],
            map: (r: Row) => ({ journalNumber: r.journalNumber, journalDate: r.journalDate, description: r.description ?? "", debitTotal: r.debitTotal, creditTotal: r.creditTotal }),
            sheetName: "Jurnal",
          }}
        />
        </CardContent>
      </Card>
    </div>
  );
}
