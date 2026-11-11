"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, PencilIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { ImportExportButtons } from "@/components/app/import-buttons";
import { PageHeader } from "@/components/app/page-header";
import { ActionButton } from "@/components/performance/action-button";
import { MasterCrudDialog, type MasterField } from "@/components/performance/master-crud-dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  archiveEmployeeAction,
  archiveEmployeesAction,
  createEmployeeAction,
  updateEmployeeAction,
} from "@/server/actions/hr";

export interface EmployeeTableRow {
  id: string;
  employeeNumber: string;
  name: string;
  positionId: string | null;
  positionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  joinedAt: string | null;
  status: string;
  phone: string | null;
  basicSalary: string | null;
}

export interface MasterOption {
  id: string;
  name: string;
}

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  AKTIF: "success",
  CUTI: "warning",
  RESIGN: "danger",
};

function formatSalary(v: string | null): string {
  if (!v) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const rupiah = n >= 1_000_000_000 ? n / 100 : n;
  return `Rp ${Math.round(rupiah).toLocaleString("id-ID")}`;
}

function formatTanggal(v: string | null): string {
  if (!v) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${String(v).slice(0, 10)}T00:00:00+07:00`));
}

export function EmployeeTable({
  employees,
  departments,
  positions,
  initialSearch = "",
}: {
  employees: EmployeeTableRow[];
  departments: MasterOption[];
  positions: MasterOption[];
  initialSearch?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState(initialSearch);
  const [bulkAsk, setBulkAsk] = useState<{ ids: string[]; count: number } | null>(null);
  const bulkClearRef = useRef<() => void>(() => {});

  const runBulkArchive = (ids: string[]) =>
    start(async () => {
      const res = await archiveEmployeesAction(ids);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${ids.length} karyawan diarsipkan`);
      bulkClearRef.current();
      router.refresh();
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q)
    );
  }, [employees, query]);

  const fields: MasterField[] = [
    { name: "name", label: "Nama", required: true },
    { name: "employeeNumber", label: "Nomor Karyawan", placeholder: "Kosongkan = otomatis" },
    {
      name: "departmentId",
      label: "Departemen",
      type: "select",
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    {
      name: "positionId",
      label: "Jabatan",
      type: "select",
      options: positions.map((p) => ({ value: p.id, label: p.name })),
    },
    { name: "joinedAt", label: "Tanggal Bergabung", type: "date" },
    { name: "phone", label: "Telepon" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "AKTIF",
      options: [
        { value: "AKTIF", label: "Aktif" },
        { value: "CUTI", label: "Cuti" },
        { value: "RESIGN", label: "Resign" },
      ],
    },
    { name: "basicSalary", label: "Gaji Pokok (Rp)", type: "number" },
  ];

  const columns: DataTableColumn<EmployeeTableRow>[] = [
    {
      key: "nip",
      header: "NIP",
      cell: (e) => (
        <span className="font-data text-[13px] text-muted-foreground">{e.employeeNumber}</span>
      ),
    },
    {
      key: "nama",
      header: "Nama",
      cell: (e) => <span className="font-semibold text-foreground">{e.name}</span>,
    },
    {
      key: "departemen",
      header: "Departemen",
      cell: (e) => <span className="text-muted-foreground">{e.departmentName ?? "—"}</span>,
    },
    {
      key: "jabatan",
      header: "Jabatan",
      cell: (e) => <span className="text-muted-foreground">{e.positionName ?? "—"}</span>,
    },
    {
      key: "bergabung",
      header: "Bergabung",
      cell: (e) => (
        <span className="tabular-nums text-muted-foreground">{formatTanggal(e.joinedAt)}</span>
      ),
    },
    {
      key: "gaji",
      header: "Gaji Pokok",
      align: "right",
      cell: (e) => (
        <span className="font-data text-[13px] tabular-nums">{formatSalary(e.basicSalary)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <Badge variant={statusVariant[e.status] ?? "neutral"}>{e.status}</Badge>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "right",
      cell: (e) => (
        <div className="flex justify-end gap-1.5">
          <MasterCrudDialog
            title={`Ubah ${e.name}`}
            fields={fields}
            action={updateEmployeeAction}
            editValues={{
              id: e.id,
              name: e.name,
              employeeNumber: e.employeeNumber,
              departmentId: e.departmentId ?? "",
              positionId: e.positionId ?? "",
              joinedAt: e.joinedAt ? String(e.joinedAt).slice(0, 10) : "",
              phone: e.phone ?? "",
              status: e.status,
              basicSalary: e.basicSalary ?? "",
            }}
            trigger={
              <Button variant="outline" size="sm" aria-label={`Ubah ${e.name}`}>
                <PencilIcon className="h-4 w-4" />
                Ubah
              </Button>
            }
          />
          <ActionButton
            action={archiveEmployeeAction}
            params={[e.id]}
            label="Arsip"
            icon={<ArchiveIcon className="h-4 w-4" />}
            variant="outline"
            confirmMessage={`Arsipkan ${e.name}? Status menjadi RESIGN dan tidak lagi muncul di penilaian baru.`}
            successMessage="Karyawan diarsipkan"
            disabled={e.status === "RESIGN"}
          />
        </div>
      ),
    },
  ];

  const counts = {
    aktif: visible.filter((e) => e.status === "AKTIF").length,
    cuti: visible.filter((e) => e.status === "CUTI").length,
    resign: visible.filter((e) => e.status === "RESIGN").length,
  };

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description={`${visible.length} karyawan terdaftar · data kepegawaian, jabatan, dan kehadiran.`}
        actions={
          <MasterCrudDialog
            title="Tambah Karyawan"
            description="Nomor karyawan dibuat otomatis bila dikosongkan."
            fields={fields}
            action={createEmployeeAction}
            trigger={
              <Button>
                <UserPlusIcon className="h-4 w-4" />
                Tambah Karyawan
              </Button>
            }
          />
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-4">
        {(
          [
            ["Aktif", counts.aktif],
            ["Cuti", counts.cuti],
            ["Resign", counts.resign],
          ] as const
        ).map(([label, n]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{n}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(e) => e.id}
        unit="karyawan"
        exportable={{
          extra: (
            <ImportExportButtons
              endpoint="/api/hr/employees/import"
              filename="karyawan"
              columns={[
                { label: "Nama", key: "name", example: "Budi Santoso" },
                { label: "NIP", key: "employeeNumber", example: "EMP-0001 (kosongkan utk otomatis)" },
                { label: "Telepon", key: "phone", example: "0812-xxxx-xxxx" },
                { label: "Tgl Masuk", key: "joinedAt", example: "2026-01-15" },
                { label: "Gaji Dasar", key: "basicSalary", example: "3500000" },
              ]}
              extraTemplateNote="Nama wajib; NIP kosong dibuat otomatis; Gaji Dasar angka (Rp)"
            />
          ),
          filename: "karyawan",
          columns: [
            { key: "employeeNumber", label: "NIP" },
            { key: "name", label: "Nama" },
            { key: "positionName", label: "Jabatan" },
            { key: "departmentName", label: "Departemen" },
            { key: "phone", label: "Telepon" },
            { key: "joinedAt", label: "Tgl Masuk" },
            { key: "status", label: "Status" },
          ],
          map: (e) => ({
            employeeNumber: e.employeeNumber,
            name: e.name,
            positionName: e.positionName ?? "",
            departmentName: e.departmentName ?? "",
            phone: e.phone ?? "",
            joinedAt: e.joinedAt ?? "",
            status: e.status,
          }),
          sheetName: "Karyawan",
        }}
        selectable
        showIndex
        emptyTitle="Belum ada karyawan"
        emptyDescription="Tambahkan karyawan pertama untuk mulai mencatat kehadiran dan kinerja."
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {visible.length} karyawan
              {query ? ` (difilter dari ${employees.length})` : ""}
            </p>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama / NIP…"
                aria-label="Cari karyawan"
                className="h-10 w-64 rounded-xl bg-surface/70 pl-9 pr-3 text-sm text-foreground ring-1 ring-input placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
          </div>
        }
        bulkActions={(selected, clear) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              bulkClearRef.current = clear;
              setBulkAsk({ ids: selected.map((e) => e.id), count: selected.length });
            }}
          >
            <ArchiveIcon className="h-4 w-4" />
            Arsipkan terpilih
          </Button>
        )}
      />

      <ConfirmDialog
        open={bulkAsk !== null}
        onOpenChange={(v) => {
          if (!v) setBulkAsk(null);
        }}
        title={`Arsipkan ${bulkAsk?.count ?? 0} karyawan terpilih?`}
        description="Karyawan yang diarsipkan berstatus RESIGN dan tidak lagi muncul di penilaian baru. Datanya tetap tersimpan."
        confirmLabel="Ya, arsipkan"
        tone="danger"
        pending={pending}
        onConfirm={() => {
          const ids = bulkAsk?.ids ?? [];
          setBulkAsk(null);
          if (ids.length > 0) runBulkArchive(ids);
        }}
      />
    </div>
  );
}
