"use client";

import Link from "next/link";
import { ArchiveIcon, PencilIcon, PlusIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { MasterCrudDialog, type MasterField, type MasterFormState } from "@/components/performance/master-crud-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";

export interface MasterDataRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  /** Kolom tambahan (mis. "Unit Usaha" / "Departemen"). */
  extra?: string | null;
  extraLabel?: string;
  /** Kolom tipe berbadge (mis. Online / Offline). */
  type?: string | null;
  typeLabel?: string;
  typeVariant?: "info" | "gold";
  /** Nilai form untuk dialog ubah. */
  editValues: Record<string, string>;
}

interface Props {
  title: string;
  description: string;
  /** Satuan data pada footer paginasi, mis. "unit". */
  unit: string;
  createTitle: string;
  createLabel: string;
  rows: MasterDataRow[];
  createFields: MasterField[];
  editFields: MasterField[];
  createAction: (prev: MasterFormState, fd: FormData) => Promise<MasterFormState>;
  updateAction: (prev: MasterFormState, fd: FormData) => Promise<MasterFormState>;
  /** Path halaman untuk tombol tampil/sembunyikan non-aktif. */
  togglePath?: string;
  showAll?: boolean;
  /** Aktifkan ceklist + tombol "Non-aktifkan Masal". */
  bulkDeactivateAction?: (ids: string[]) => Promise<{ error?: string }>;
  /** Nama file export Excel/PDF (tanpa ekstensi); tampil bila diisi. */
  exportFilename?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Tabel master data gaya Jurnal Guru: header gelap, zebra baris, nomor urut,
 * kolom status berbadge, aksi ubah per baris, dan paginasi.
 */
export function MasterDataTable({
  title,
  description,
  unit,
  createTitle,
  createLabel,
  rows,
  createFields,
  editFields,
  createAction,
  updateAction,
  togglePath,
  showAll = false,
  bulkDeactivateAction,
  exportFilename,
  emptyTitle = "Belum ada data",
  emptyDescription,
}: Props) {
  const columns: DataTableColumn<MasterDataRow>[] = [
    {
      key: "kode",
      header: "Kode",
      cell: (r) => <span className="font-data text-[12px] font-semibold text-primary">{r.code}</span>,
    },
    {
      key: "nama",
      header: "Nama",
      cell: (r) => <span className="font-semibold text-foreground">{r.name}</span>,
    },
  ];

  if (rows.some((r) => r.extraLabel)) {
    columns.push({
      key: "extra",
      header: rows[0].extraLabel ?? "",
      cell: (r) => <span className="text-muted-foreground">{r.extra ?? "—"}</span>,
    });
  }

  if (rows.some((r) => r.typeLabel)) {
    columns.push({
      key: "type",
      header: rows[0].typeLabel ?? "",
      cell: (r) => (
        <Badge variant={r.typeVariant ?? "info"}>{r.type ?? "—"}</Badge>
      ),
    });
  }

  columns.push({
    key: "status",
    header: "Status",
    cell: (r) => (
      <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "aktif" : "non-aktif"}</Badge>
    ),
  });

  columns.push({
    key: "aksi",
    header: "Aksi",
    align: "right",
    cell: (r) => (
      <div className="flex justify-end">
        <MasterCrudDialog
          title={`Ubah ${r.name}`}
          fields={editFields}
          action={updateAction}
          editValues={r.editValues}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Ubah ${r.name}`}>
              <PencilIcon className="h-4 w-4" />
            </Button>
          }
        />
      </div>
    ),
  });

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <MasterCrudDialog
            title={createTitle}
            fields={createFields}
            action={createAction}
            trigger={
              <Button>
                <PlusIcon className="h-4 w-4" />
                {createLabel}
              </Button>
            }
          />
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        unit={unit}
        showIndex
        selectable={Boolean(bulkDeactivateAction)}
        bulkActions={
          bulkDeactivateAction
            ? (selected, clear) => (
                <ConfirmButton
                  trigger={
                    <Button variant="destructive" size="sm">
                      <ArchiveIcon className="h-4 w-4" />
                      Non-aktifkan Masal
                    </Button>
                  }
                  title="Non-aktifkan data terpilih?"
                  description={`${selected.length} baris yang dipilih akan dinon-aktifkan (data tetap tersimpan).`}
                  confirmLabel="Ya, non-aktifkan"
                  tone="danger"
                  onConfirm={async () => {
                    const res = await bulkDeactivateAction(selected.map((r) => r.id));
                    if (!res.error) clear();
                    return res;
                  }}
                />
              )
            : undefined
        }
        exportable={
          exportFilename
            ? {
                filename: exportFilename,
                columns: [
                  { key: "code", label: "Kode" },
                  { key: "name", label: "Nama" },
                  ...(rows.some((r) => r.extraLabel) ? [{ key: "extra", label: rows[0]?.extraLabel ?? "Tambahan" }] : []),
                  ...(rows.some((r) => r.typeLabel) ? [{ key: "type", label: rows[0]?.typeLabel ?? "Tipe" }] : []),
                  { key: "status", label: "Status" },
                ],
                map: (r) => ({
                  code: r.code,
                  name: r.name,
                  extra: r.extra ?? "",
                  type: r.type ?? "",
                  status: r.isActive ? "aktif" : "non-aktif",
                }),
                sheetName: title,
              }
            : undefined
        }
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{rows.length} {unit}</p>
            {togglePath && (
              <Link href={showAll ? togglePath : `${togglePath}?showAll=1`}>
                <Button variant="outline" size="sm">
                  {showAll ? "Sembunyikan Non-aktif" : "Tampilkan Non-aktif"}
                </Button>
              </Link>
            )}
          </div>
        }
      />
    </div>
  );
}
