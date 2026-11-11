"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/app/table-pagination";
import { TableExportButtons, type ExportColumn } from "@/components/app/table-export";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  headClassName?: string;
  cellClassName?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Jumlah baris per halaman (Jurnal Guru memakai 25). */
  pageSize?: number;
  pagination?: { page: number; total: number; onChange: (page: number) => void };
  /** Label satuan data pada footer, mis. "karyawan". */
  unit?: string;
  /** Tampilkan checkbox pilihan baris + toolbar aksi massal. */
  selectable?: boolean;
  /** Tampilkan kolom nomor urut. */
  showIndex?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Kontrol di atas tabel (pencarian, filter, dsb). */
  toolbar?: React.ReactNode;
  /** Aksi massal; menerima baris terpilih + callback untuk mengosongkan seleksi. */
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  /** Tombol Export Excel/PDF di atas tabel. */
  exportable?: {
    /** Nama file tanpa ekstensi. */
    filename: string;
    /** Kolom yang diekspor. */
    columns: ExportColumn[];
    /** Ubah baris menjadi {key: nilai datar}. */
    map: (row: T) => Record<string, unknown>;
    /** Nama sheet Excel. */
    sheetName?: string;
    /** Tombol tambahan (Impor/Template dsb) yang menyatu dengan kelompok export. */
    extra?: React.ReactNode;
  };
  className?: string;
}

/**
 * Tabel data gaya Jurnal Guru (guru.cintabuku.site): header gelap sticky,
 * baris zebra, hover hangat, checkbox select-all + baris aksi massal,
 * dan paginasi window ("N data · Halaman x/y").
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 25,
  pagination,
  unit = "data",
  selectable = false,
  showIndex = false,
  emptyTitle = "Belum ada data",
  emptyDescription,
  toolbar,
  bulkActions,
  exportable,
  className,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((pagination?.total ?? rows.length) / pageSize));
  const safePage = Math.max(1, Math.min(pagination?.page ?? page, totalPages));
  const offset = (safePage - 1) * pageSize;
  const pageRows = useMemo(() => pagination ? rows : rows.slice(offset, offset + pageSize), [rows, offset, pageSize, pagination]);

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(rowKey(r))),
    [rows, selected, rowKey]
  );

  const pageIds = pageRows.map((r) => rowKey(r));
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const colSpan = columns.length + (selectable ? 1 : 0) + (showIndex ? 1 : 0);

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}

      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2">
          <span className="text-sm font-semibold text-danger-soft-foreground">
            {selectedRows.length} terpilih
          </span>
          {bulkActions?.(selectedRows, clearSelection)}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Batalkan pilihan
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line-warm bg-surface">
        {exportable && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">{rows.length} {unit}</span>
            <div className="flex items-center gap-1.5">
              {exportable.extra}
              <TableExportButtons
                filename={exportable.filename}
                columns={exportable.columns}
                rows={rows.map(exportable.map)}
                sheetName={exportable.sheetName}
              />
            </div>
          </div>
        )}
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-table-head text-table-head-fg">
              {selectable && (
                <th className="w-10 rounded-tl-xl px-3 py-3 text-left align-middle">
                  <Checkbox
                    checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Pilih semua baris"
                    className="border-white/40 bg-transparent data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-table-head data-[state=indeterminate]:border-white data-[state=indeterminate]:bg-white data-[state=indeterminate]:text-table-head"
                  />
                </th>
              )}
              {showIndex && (
                <th className="w-12 px-3 py-3 text-left align-middle text-[11.5px] font-semibold uppercase tracking-[0.5px]">
                  No
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-3 align-middle text-[11.5px] font-semibold uppercase tracking-[0.5px] whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.headClassName
                  )}
                >
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
                  {emptyDescription && (
                    <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
                  )}
                </td>
              </tr>
            )}
            {pageRows.map((row, i) => {
              const id = rowKey(row);
              const checked = selected.has(id);
              return (
                <tr
                  key={id}
                  className={cn(
                    "transition-colors",
                    checked ? "bg-primary/5" : i % 2 === 1 ? "bg-table-stripe" : "bg-surface",
                    "hover:bg-table-hover"
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5 align-middle">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label="Pilih baris"
                      />
                    </td>
                  )}
                  {showIndex && (
                    <td className="px-3 py-2.5 align-middle text-sm tabular-nums text-muted-foreground">
                      {offset + i + 1}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2.5 align-middle text-sm text-foreground",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.cellClassName
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        current={safePage}
        total={pagination?.total ?? rows.length}
        pageSize={pageSize}
        onChange={pagination?.onChange ?? setPage}
        unit={unit}
      />
    </div>
  );
}
