"use client";
import { useRouter } from "next/navigation";

import type * as React from "react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArchiveIcon, MessageCircleIcon, PencilIcon } from "lucide-react";
import { EditCustomerButton, type CustomerFormValue } from "@/components/customers/customer-form-dialog";
import { ArchiveCustomerButton } from "@/components/customers/archive-button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { bulkArchiveCustomersAction, sendCustomerConfirmationAction } from "@/server/actions/customers";
import type { customers } from "@/db/schema";

export type CustomerRow = typeof customers.$inferSelect;

interface CustomerDataTableProps {
  rows: CustomerRow[];
  pagination?: { page: number; total: number; search?: string };
  toolbar?: React.ReactNode;
  unit?: string;
  /** Tombol tambahan (Impor/Template) yang menyatu di pita export. */
  exportExtra?: React.ReactNode;
}

export function CustomerDataTable({ rows, toolbar, unit = "pelanggan", exportExtra, pagination }: CustomerDataTableProps) {
  const router = useRouter();
  function toFormValue(r: CustomerRow): CustomerFormValue {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      phone: r.phone ?? undefined,
      whatsapp: r.whatsapp ?? undefined,
      email: r.email ?? undefined,
      city: r.city ?? undefined,
      province: r.province ?? undefined,
      address: r.address ?? undefined,
      npwp: r.npwp ?? undefined,
      source: r.source ?? undefined,
      notes: r.notes ?? undefined,
      ayahName: r.ayahName ?? undefined,
      ibuName: r.ibuName ?? undefined,
      birthPlace: r.birthPlace ?? undefined,
      birthDate: r.birthDate ? String(r.birthDate).slice(0, 10) : undefined,
      packageName: r.packageName ?? undefined,
      deliveryDate: r.deliveryDate ? new Date(r.deliveryDate).toISOString().slice(0, 10) : undefined,
      deliverySlot: r.deliverySlot ?? undefined,
      consent: r.consent ?? undefined,
    };
  }

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: "code",
      header: "Kode",
      cell: (r) => <span className="font-data text-[12px] font-semibold text-primary">{r.code}</span>,
    },
    {
      key: "nama",
      header: "Nama",
      cell: (r) => (
        <div>
          <p className="font-semibold text-foreground">{r.name}</p>
          {!r.isActive && <Badge variant="neutral" className="mt-1">arsip</Badge>}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipe",
      cell: (r) => (
        <Badge variant={r.type === "PERUSAHAAN" ? "info" : "neutral"}>
          {r.type === "PERUSAHAAN" ? "Lembaga" : "Perorangan"}
        </Badge>
      ),
    },
    {
      key: "kontak",
      header: "Kontak",
      cell: (r) => <>{r.phone ?? "—"}</>,
    },
    {
      key: "kota",
      header: "Kota",
      cell: (r) => <>{r.city ?? "—"}</>,
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <ConfirmButton
            trigger={
              <Button variant="ghost" size="sm" title="Kirim WA Konfirmasi">
                <MessageCircleIcon className="h-4 w-4" />
              </Button>
            }
            title="Kirim WA konfirmasi pemesanan?"
            description={`Pesan template "Alhamdulillah Barakallah" akan dikirim ke nomor ${r.phone ?? "-"}.`}
            confirmLabel="Ya, kirim"
            tone="info"
            onConfirm={async () => {
              const res = await sendCustomerConfirmationAction(r.id);
              if (res?.error) return res as unknown as { error?: string };
              return undefined;
            }}
          />
          <EditCustomerButton customer={toFormValue(r)} />
          <ArchiveCustomerButton id={r.id} />
        </div>
      ),
    },
  ];

  return (
    <DataTable<CustomerRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      selectable
      unit={unit}
      pageSize={100}
      pagination={pagination ? { ...pagination, onChange: (page) => router.push(`/customers?${new URLSearchParams({ q: pagination.search ?? "", page: String(page) })}`) } : undefined}
      showIndex
      emptyTitle="Belum ada pelanggan"
      emptyDescription="Tambahkan pelanggan pertama untuk mulai order."
      toolbar={toolbar}
      exportable={{
        filename: "pelanggan",
        columns: [
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "type", label: "Tipe" },
          { key: "phone", label: "Telepon" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "email", label: "Email" },
          { key: "address", label: "Alamat" },
          { key: "city", label: "Kota" },
          { key: "status", label: "Status" },
        ],
        map: (r) => ({
          code: r.code,
          name: r.name,
          type: r.type === "PERUSAHAAN" ? "Lembaga" : "Perorangan",
          phone: r.phone ?? "",
          whatsapp: r.whatsapp ?? "",
          email: r.email ?? "",
          address: r.address ?? "",
          city: r.city ?? "",
          status: r.isActive ? "aktif" : "arsip",
        }),
        sheetName: "Pelanggan",
        extra: exportExtra,
      }}
      bulkActions={(selected, clear) => (
        <div className="flex items-center gap-2">
          <ConfirmButton
            trigger={
              <Button variant="destructive" size="sm">
                <ArchiveIcon className="h-4 w-4" />
                Hapus Masal
              </Button>
            }
            title="Arsipkan pelanggan terpilih?"
            description={`${selected.length} pelanggan yang dipilih akan dihapus dari daftar aktif (data tetap tersimpan sebagai arsip).`}
            confirmLabel="Ya, hapus"
            tone="danger"
            onConfirm={async () => {
              const res = await bulkArchiveCustomersAction(selected.map((c) => c.id));
              if (!res.error) clear();
              return res;
            }}
          />
        </div>
      )}
    />
  );
}
