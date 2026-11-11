"use client";

import { useMemo, useState } from "react";
import { TrashIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/app/table-pagination";
import { TableExportButtons, type ExportColumn } from "@/components/app/table-export";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RscColumn {
  key: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
}

export interface RscRow {
  id: string;
  /** Sel selaras dengan urutan kolom */
  cells: React.ReactNode[];
}

export interface RscExport {
  filename: string;
  columns: ExportColumn[];
  /** Nilai sudah diratakan di server (murni data, bukan fungsi) */
  values: Record<string, unknown>[];
  sheetName?: string;
}

interface BulkDeleteDef {
  /** Server action — penerima ids */
  action: (ids: string[]) => Promise<{ error?: string }>;
  confirm?: string;
}

export interface RscGridProps {
  columns: RscColumn[];
  rows: RscRow[];
  rowKey?: (row: RscRow) => string;
  pageSize?: number;
  unit?: string;
  selectable?: boolean;
  bulkDelete?: BulkDeleteDef;
  toolbar?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  exportable?: RscExport;
}

export function RscGrid({
  columns,
  rows,
  pageSize = 25,
  unit = "data",
  selectable = false,
  bulkDelete,
  toolbar,
  emptyTitle = "Belum ada data",
  emptyDescription,
  exportable,
  className,
}: RscGridProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const pageRows = useMemo(() => rows.slice(offset, offset + pageSize), [rows, offset, pageSize]);

  const pageIds = pageRows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const colSpan = columns.length + (selectable ? 1 : 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function bulkDeleteNow(ids: string[]) {
    if (!bulkDelete) return;
    return bulkDelete.action(ids).then((res) => {
      if (!res?.error) setSelected(new Set());
      return res;
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}

      {selectable && selected.size > 0 && bulkDelete && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2">
          <span className="text-sm font-semibold text-danger-soft-foreground">{selected.size} terpilih</span>
          <ConfirmButton
            tone="danger"
            title={`Hapus ${selected.size} data terpilih?`}
            description={bulkDelete.confirm ?? "Aksi tetap tercatat di Log Audit."}
            confirmLabel="Ya, hapus"
            trigger={
              <Button size="compact" variant="destructive">
                <TrashIcon className="h-3.5 w-3.5" />
                Hapus {selected.size}
              </Button>
            }
            onConfirm={() => bulkDeleteNow(Array.from(selected))}
          />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Batalkan pilihan
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line-warm bg-surface">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-head text-table-head-fg">
              {selectable && (
                <th className="w-10 rounded-tl-xl px-3 py-3 text-left align-middle">
                  <Checkbox
                    checked={pageIds.length > 0 && allOnPage ? true : someOnPage ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Pilih semua baris"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={cn("px-3 py-3 align-middle text-[11.5px] font-semibold uppercase tracking-[0.5px]", col.align === "right" && "text-right", col.align === "center" && "text-center")}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                  {emptyDescription && <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>}
                </td>
              </tr>
            )}
            {pageRows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors",
                  selected.has(row.id) ? "bg-primary/5" : i % 2 === 1 ? "bg-table-stripe" : "bg-surface",
                  "hover:bg-table-hover"
                )}
              >
                {selectable && (
                  <td className="px-3 py-2.5 align-middle">
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label="Pilih baris" />
                  </td>
                )}
                {row.cells.map((cell, ci) => (
                  <td
                    key={columns[ci]?.key ?? ci}
                    className={cn("px-3 py-2.5 align-middle text-sm text-foreground", columns[ci]?.align === "right" && "text-right", columns[ci]?.align === "center" && "text-center")}
                  >
                    {cell ?? null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination current={safePage} total={rows.length} pageSize={pageSize} onChange={setPage} unit={unit} />

      {exportable && rows.length > 0 && exportable.values.length > 0 && (
        <div className="flex justify-end">
          <TableExportButtons
            filename={exportable.filename}
            columns={exportable.columns}
            rows={exportable.values}
            sheetName={exportable.sheetName}
          />
        </div>
      )}
    </div>
  );
}
