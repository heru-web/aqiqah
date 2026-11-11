"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/app/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createAccountAction, toggleAccountAction, updateAccountAction, type CoaFormState } from "@/server/actions/coa";
import { useActionState } from "react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  group: string | null;
  description: string | null;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
  isSystem: boolean;
  openingBalance: string;
};

const TYPE_LABEL: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  INCOME: "Pendapatan",
  EXPENSE: "Beban",
};

export function CoaTable({ accounts }: { accounts: Account[] }) {
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState<Account | null>(null);
  const [stateCreate, formCreate] = useActionState(createAccountAction, undefined as CoaFormState);
  const [stateEdit, formEdit] = useActionState(
    async (prev: CoaFormState, fd: FormData) => updateAccountAction(openEdit?.id ?? "", prev, fd),
    undefined as CoaFormState
  );

  const columns = useMemo<DataTableColumn<Account>[]>(
    () => [
      { key: "code", header: "Kode", cell: (r: Account) => <span className="font-mono text-xs">{r.code}</span> },
      { key: "name", header: "Nama Akun", cell: (r: Account) => <span className="font-medium">{r.name}</span> },
      { key: "type", header: "Tipe", cell: (r: Account) => <Badge variant="neutral">{TYPE_LABEL[r.type] ?? r.type}</Badge> },
      { key: "group", header: "Grup", cell: (r: Account) => r.group ?? "-" },
      { key: "postable", header: "Dapat Dipost", cell: (r: Account) => (r.isPostable ? "Ya" : "Tidak") },
      { key: "status", header: "Status", cell: (r: Account) => (r.isActive ? <Badge variant="success">Aktif</Badge> : <Badge variant="danger">Nonaktif</Badge>) },
      {
        key: "actions",
        header: "Aksi",
        className: "text-right",
        cell: (r: Account) => (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenEdit(r)}>
              Ubah
            </Button>
            {!r.isSystem && (
              <Button size="sm" variant="ghost" onClick={() => toggleAccountAction(r.id, !r.isActive)}>
                {r.isActive ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Bagan Akun (COA)"
        description="Kelola daftar akun untuk jurnal akuntansi."
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
          rowKey={(r: Account) => r.id}
          emptyTitle="Belum ada akun"
          exportable={{
            filename: "bagan-akun",
            columns: [
              { key: "code", label: "Kode" },
              { key: "name", label: "Nama Akun" },
              { key: "type", label: "Tipe" },
              { key: "group", label: "Grup" },
              { key: "isActive", label: "Status" },
            ],
            map: (r: Account) => ({ code: r.code, name: r.name, type: TYPE_LABEL[r.type] ?? r.type, group: r.group ?? "", isActive: r.isActive ? "aktif" : "non-aktif" }),
            sheetName: "Bagan Akun",
          }}
        />
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Tambah Akun</DialogTitle>
            <DialogDescription>Tambah akun baru ke bagan akun.</DialogDescription>
          </DialogHeader>
          <form action={formCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="code">Kode</Label>
                <Input id="code" name="code" placeholder="1-1101" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipe</Label>
                <select id="type" name="type" className="flex h-10 w-full rounded-2xl bg-surface px-3.5 text-sm ring-1 ring-input" required>
                  <option value="ASSET">Aset</option>
                  <option value="LIABILITY">Kewajiban</option>
                  <option value="EQUITY">Ekuitas</option>
                  <option value="INCOME">Pendapatan</option>
                  <option value="EXPENSE">Beban</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nama Akun</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="group">Grup</Label>
                <Input id="group" name="group" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingBalance">Saldo Awal (Rp)</Label>
                <Input id="openingBalance" name="openingBalance" type="number" defaultValue="0" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Dapat diposting</p>
                <p className="text-xs text-muted-foreground">Hanya akun postable yang bisa diisi di jurnal.</p>
              </div>
              <Switch name="isPostable" defaultChecked />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Keterangan</Label>
              <Textarea id="description" name="description" rows={3} />
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
            <DialogTitle>Ubah Akun</DialogTitle>
            <DialogDescription>{openEdit?.code} — {openEdit?.name}</DialogDescription>
          </DialogHeader>
          <form action={formEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Akun</Label>
              <Input id="name" name="name" defaultValue={openEdit?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="group">Grup</Label>
                <Input id="group" name="group" defaultValue={openEdit?.group ?? ""} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Dapat diposting</p>
              </div>
              <Switch name="isPostable" defaultChecked={openEdit?.isPostable} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Keterangan</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={openEdit?.description ?? ""} />
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
