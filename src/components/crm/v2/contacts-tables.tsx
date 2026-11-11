"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { ImportExportButtons } from "@/components/app/import-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { formatIDRShort } from "@/lib/utils";
import { deletePersonAction, deleteOrganizationAction } from "@/server/actions/crm";

export interface PersonRowData {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  organizationName: string | null;
  ownerName: string | null;
  dealCount: number;
  openValue: string;
}

export interface OrganizationRowData {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  ownerName: string | null;
  peopleCount: number;
  dealCount: number;
  openValue: string;
}

export function PeopleTable({ rows }: { rows: PersonRowData[] }) {
  const router = useRouter();

  const columns: DataTableColumn<PersonRowData>[] = [
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/crm/contacts/people/${row.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
            {row.name}
          </Link>
          <p className="text-[11px] text-muted-foreground">{row.organizationName ?? row.city ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Kontak",
      cell: (row) => (
        <div className="space-y-0.5 text-[12px]">
          <p>{row.phone ?? "—"}</p>
          {row.email && <p className="text-muted-foreground">{row.email}</p>}
        </div>
      ),
    },
    {
      key: "deals",
      header: "Deal",
      align: "center",
      cell: (row) => <Badge variant="neutral">{row.dealCount}</Badge>,
    },
    {
      key: "value",
      header: "Nilai terbuka",
      align: "right",
      cell: (row) => (
        <span className="text-[12px] font-semibold tabular-nums">{formatIDRShort(row.openValue)}</span>
      ),
    },
    {
      key: "owner",
      header: "Pemilik",
      cell: (row) => <span className="text-[12px] text-muted-foreground">{row.ownerName ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {row.whatsapp && (
            <Button asChild variant="ghost" size="compact" className="h-7 w-7 p-0">
              <a
                href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Chat WhatsApp"
              >
                <MessageCircleIcon className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <ConfirmButton
            tone="danger"
            title="Hapus kontak ini?"
            description="Kontak akan diarsipkan dari daftar. Deal terkait tetap tersimpan di pipeline, aktivitas terkait ikut diarsipkan."
            confirmLabel="Ya, hapus kontak"
            onConfirm={async () => {
              const result = await deletePersonAction(row.id);
              if (result.error) return result.error;
              toast.success("Kontak dihapus.");
              router.refresh();
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="compact"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                title="Hapus kontak"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      unit="kontak"
      selectable
      bulkActions={(selected, clear) => (
        <ConfirmButton
          tone="danger"
          title="Hapus kontak terpilih?"
          description={`${selected.length} kontak yang dipilih akan dihapus dari daftar.`}
          confirmLabel="Ya, hapus"
          onConfirm={async () => {
            for (const row of selected) {
              const res = await deletePersonAction(row.id);
              if (res && "error" in res && res.error) return { error: res.error };
            }
            toast.success(`${selected.length} kontak dihapus.`);
            clear();
            router.refresh();
            return undefined;
          }}
          trigger={<Button type="button" variant="destructive" size="sm" title="Hapus terpilih"><Trash2Icon className="h-4 w-4" />Hapus Masal</Button>}
        />
      )}
      exportable={{
        extra: (
          <ImportExportButtons
            endpoint="/api/crm/contacts/import"
            filename="kontak-person"
            columns={[
              { label: "Nama", key: "name", example: "Bpk. Ahmad Faizi" },
              { label: "Telepon", key: "phone", example: "0812-xxxx-xxxx" },
              { label: "WhatsApp", key: "whatsapp", example: "0812-xxxx-xxxx" },
              { label: "Email", key: "email", example: "nama@email.com" },
              { label: "Kota", key: "city", example: "Bandung" },
              { label: "Organisasi", key: "organization", example: "Yayasan Contoh" },
            ]}
          />
        ),
        filename: "kontak-person",
        columns: [
          { key: "name", label: "Nama" },
          { key: "organizationName", label: "Organisasi" },
          { key: "phone", label: "Telepon" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "email", label: "Email" },
          { key: "city", label: "Kota" },
          { key: "ownerName", label: "Pemilik" },
          { key: "dealCount", label: "Jml Deal" },
          { key: "openValue", label: "Nilai Terbuka" },
        ],
        map: (row) => ({
          name: row.name,
          organizationName: row.organizationName ?? "",
          phone: row.phone ?? "",
          whatsapp: row.whatsapp ?? "",
          email: row.email ?? "",
          city: row.city ?? "",
          ownerName: row.ownerName ?? "",
          dealCount: row.dealCount,
          openValue: row.openValue,
        }),
        sheetName: "Kontak",
      }}
      emptyTitle="Belum ada kontak"
      emptyDescription="Tambahkan kontak pertama untuk mulai mencatat pelanggan."
    />
  );
}

export function OrganizationsTable({ rows }: { rows: OrganizationRowData[] }) {
  const router = useRouter();

  const columns: DataTableColumn<OrganizationRowData>[] = [
    {
      key: "name",
      header: "Perusahaan",
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/crm/contacts/organizations/${row.id}`}
            className="font-semibold text-foreground hover:text-primary hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-[11px] text-muted-foreground">{row.industry ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Kontak",
      cell: (row) => (
        <div className="space-y-0.5 text-[12px]">
          <p>{row.phone ?? "—"}</p>
          {row.email && <p className="text-muted-foreground">{row.email}</p>}
        </div>
      ),
    },
    {
      key: "city",
      header: "Kota",
      cell: (row) => <span className="text-[12px]">{row.city ?? "—"}</span>,
    },
    {
      key: "people",
      header: "Kontak / Deal",
      align: "center",
      cell: (row) => (
        <span className="text-[12px] tabular-nums">
          {row.peopleCount} / {row.dealCount}
        </span>
      ),
    },
    {
      key: "value",
      header: "Nilai terbuka",
      align: "right",
      cell: (row) => (
        <span className="text-[12px] font-semibold tabular-nums">{formatIDRShort(row.openValue)}</span>
      ),
    },
    {
      key: "owner",
      header: "Pemilik",
      cell: (row) => <span className="text-[12px] text-muted-foreground">{row.ownerName ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <ConfirmButton
            tone="danger"
            title="Hapus perusahaan ini?"
            description="Perusahaan akan diarsipkan dari daftar. Kontak dan deal terkait tetap tersimpan, hanya kehilangan relasi perusahaan."
            confirmLabel="Ya, hapus perusahaan"
            onConfirm={async () => {
              const result = await deleteOrganizationAction(row.id);
              if (result.error) return result.error;
              toast.success("Perusahaan dihapus.");
              router.refresh();
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="compact"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                title="Hapus perusahaan"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      unit="perusahaan"
      selectable
      bulkActions={(selected, clear) => (
        <ConfirmButton
          tone="danger"
          title="Hapus perusahaan terpilih?"
          description={`${selected.length} perusahaan yang dipilih akan diarsipkan dari daftar.`}
          confirmLabel="Ya, hapus"
          onConfirm={async () => {
            for (const row of selected) {
              const res = await deleteOrganizationAction(row.id);
              if (res && "error" in res && res.error) return { error: res.error };
            }
            toast.success(`${selected.length} perusahaan dihapus.`);
            clear();
            router.refresh();
            return undefined;
          }}
          trigger={<Button type="button" variant="destructive" size="sm" title="Hapus terpilih"><Trash2Icon className="h-4 w-4" />Hapus Masal</Button>}
        />
      )}
      exportable={{
        filename: "kontak-perusahaan",
        columns: [
          { key: "name", label: "Nama" },
          { key: "industry", label: "Industri" },
          { key: "phone", label: "Telepon" },
          { key: "email", label: "Email" },
          { key: "city", label: "Kota" },
          { key: "ownerName", label: "Pemilik" },
          { key: "peopleCount", label: "Jml Kontak" },
          { key: "dealCount", label: "Jml Deal" },
          { key: "openValue", label: "Nilai Terbuka" },
        ],
        map: (row) => ({
          name: row.name,
          industry: row.industry ?? "",
          phone: row.phone ?? "",
          email: row.email ?? "",
          city: row.city ?? "",
          ownerName: row.ownerName ?? "",
          peopleCount: row.peopleCount,
          dealCount: row.dealCount,
          openValue: row.openValue,
        }),
        sheetName: "Perusahaan",
      }}
      emptyTitle="Belum ada perusahaan"
      emptyDescription="Tambahkan perusahaan atau instansi yang menjadi pelanggan."
    />
  );
}
