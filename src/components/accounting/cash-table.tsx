"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/app/data-table";
import { TableExportButtons, type ExportColumn } from "@/components/app/table-export";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCashAccountAction, updateCashAccountAction, type CashFormState } from "@/server/actions/cash";
import { useActionState } from "react";

type CashAccount = {
  id: string;
  branchId: string | null;
  name: string;
  type: string;
  bankName: string | null;
  accountNumber: string | null;
  openingBalance: string;
  isActive: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  BANK: "Bank",
  CASH: "Kas Tunai",
  EWALLET: "E-Wallet",
  VA: "Virtual Account",
};

export function CashTable({ accounts }: { accounts: CashAccount[] }) {
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<CashAccount | null>(null);
  const [stateCreate, formCreate] = useActionState(createCashAccountAction, undefined as CashFormState);
  const [stateEdit, formEdit] = useActionState(
    async (prev: CashFormState, fd: FormData) => updateCashAccountAction(openEdit?.id ?? "", prev, fd),
    undefined as CashFormState
  );

  const columns = useMemo<DataTableColumn<CashAccount>[]>(
    () => [
      { key: "name", header: "Nama", cell: (r: CashAccount) => <span className="font-medium">{r.name}</span> },
      { key: "type", header: "Tipe", cell: (r: CashAccount) => <Badge variant="neutral">{TYPE_LABEL[r.type] ?? r.type}</Badge> },
      { key: "bank", header: "Bank/Provider", cell: (r: CashAccount) => r.bankName ?? "-" },
      { key: "rek", header: "No. Rekening", cell: (r: CashAccount) => r.accountNumber ?? "-" },
      { key: "saldo", header: "Saldo Awal", cell: (r: CashAccount) => <span className="tabular-nums">Rp {Number(r.openingBalance || 0).toLocaleString("id-ID")}</span> },
      { key: "status", header: "Status", cell: (r: CashAccount) => (r.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="danger">Nonaktif</Badge>) },
      {
        key: "actions",
        header: "Aksi",
        className: "text-right",
        cell: (r: CashAccount) => (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setOpenEdit(r)}>
              Ubah
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Kas & Bank"
        description="Daftar akun kas dan rekening bank."
        actions={
          <Button onClick={() => setOpenCreate(true)}>
            <PlusIcon className="h-4 w-4" />
            Tambah Akun
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataTable
          columns={columns}
          rows={accounts}
          rowKey={(r: CashAccount) => r.id}
          emptyTitle="Belum ada akun kas/bank"
          exportable={{
            filename: "kas-bank",
            columns: [
              { key: "name", label: "Nama" },
              { key: "type", label: "Tipe" },
              { key: "openingBalance", label: "Saldo Awal" },
            ],
            map: (r: CashAccount) => ({ name: r.name, type: TYPE_LABEL[r.type] ?? r.type, openingBalance: Number(r.openingBalance ?? 0) }),
            sheetName: "Kas & Bank",
          }}
        />
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Tambah Akun Kas/Bank</DialogTitle>
            <DialogDescription>Tambah akun kas atau rekening bank baru.</DialogDescription>
          </DialogHeader>
          <form action={formCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Akun</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="type">Tipe</Label>
                <select id="type" name="type" className="flex h-10 w-full rounded-2xl bg-surface px-3.5 text-sm ring-1 ring-input" required>
                  <option value="CASH">Kas Tunai</option>
                  <option value="BANK">Bank</option>
                  <option value="EWALLET">E-Wallet</option>
                  <option value="VA">Virtual Account</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingBalance">Saldo Awal (Rp)</Label>
                <Input id="openingBalance" name="openingBalance" type="number" defaultValue="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank/Provider</Label>
                <Input id="bankName" name="bankName" placeholder="BSI, Mandiri, dll" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">No. Rekening</Label>
                <Input id="accountNumber" name="accountNumber" />
              </div>
            </div>
            {stateCreate?.error && <p className="text-sm text-danger">{stateCreate.error}</p>}
            {stateCreate?.success && <p className="text-sm text-success">Akun berhasil ditambahkan.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openEdit} onOpenChange={(v) => !v && setOpenEdit(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ubah Akun Kas/Bank</DialogTitle>
            <DialogDescription>{openEdit?.name}</DialogDescription>
          </DialogHeader>
          <form action={formEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Akun</Label>
              <Input id="name" name="name" defaultValue={openEdit?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank/Provider</Label>
                <Input id="bankName" name="bankName" defaultValue={openEdit?.bankName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">No. Rekening</Label>
                <Input id="accountNumber" name="accountNumber" defaultValue={openEdit?.accountNumber ?? ""} />
              </div>
            </div>
            {stateEdit?.error && <p className="text-sm text-danger">{stateEdit.error}</p>}
            {stateEdit?.success && <p className="text-sm text-success">Berhasil diubah.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenEdit(null)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
