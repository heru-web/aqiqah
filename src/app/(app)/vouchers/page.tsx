import { ActionForm } from "@/components/app/action-form";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { DeleteRowButton } from "@/components/app/table-extras";
import { deleteVouchersAction } from "@/server/actions/table-ops";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDate, formatDateTime, formatIDR } from "@/lib/utils";
import { getVoucher, listRedemptions, listVouchers, voucherSummary, type VoucherView } from "@/server/services/vouchers";
import { saveVoucherFormAction, toggleVoucherActiveFormAction } from "@/server/actions/vouchers";
import { ArchiveRestoreIcon, PencilIcon, TicketIcon } from "lucide-react";

const TYPE_LABEL: Record<string, string> = { NOMINAL: "Nominal", PERCENT: "Persen", FREE_DELIVERY: "Gratis Ongkir" };

const STATE_VARIANT: Record<VoucherView["state"], "success" | "warning" | "danger" | "neutral" | "info"> = {
  AKTIF: "success",
  KOSONG: "warning",
  EXPIRED: "danger",
  BELUM_MULAI: "info",
  NONAKTIF: "neutral",
};

const STATE_LABEL: Record<VoucherView["state"], string> = {
  AKTIF: "aktif",
  KOSONG: "kuota habis",
  EXPIRED: "kedaluwarsa",
  BELUM_MULAI: "belum mulai",
  NONAKTIF: "non-aktif",
};

function voucherValue(v: Pick<VoucherView, "type" | "nominalAmount" | "percentBps">): string {
  if (v.type === "NOMINAL") return formatIDR(v.nominalAmount);
  if (v.type === "PERCENT") return `${(v.percentBps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
  return "Gratis ongkir";
}

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; showAll?: string; rid?: string }>;
}) {
  await requirePagePermission("products.pricing.view");
  const sp = await searchParams;
  const showAll = sp.showAll === "1";
  const [rows, summary, editing, ridRow, redemptions] = await Promise.all([
    listVouchers(showAll),
    voucherSummary(),
    sp.edit ? getVoucher(sp.edit) : Promise.resolve(null),
    sp.rid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.rid) ? getVoucher(sp.rid) : Promise.resolve(null),
    sp.rid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.rid) ? listRedemptions(sp.rid) : Promise.resolve([]),
  ]);


  const columns: RscColumn[] = [
    { key: "kode", header: "Kode" },
    { key: "tipe", header: "Tipe" },
    { key: "nilai", header: "Nilai", align: "right" },
    { key: "pakai", header: "Pakai", align: "right" },
    { key: "periode", header: "Periode" },
    { key: "status", header: "Status" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = rows.map((v) => ({
    id: v.id,
    cells: [
      <span className="font-data font-semibold" key="k">{v.code}</span>,
      <Badge variant={v.type === "PERCENT" ? "info" : v.type === "FREE_DELIVERY" ? "gold" : "neutral"} key="t">{TYPE_LABEL[v.type] ?? v.type}</Badge>,
      <span className="tabular-nums font-semibold" key="n">{voucherValue(v)}</span>,
      <span className="tabular-nums text-muted-foreground" key="p">{v.usedCount}{v.remaining !== null ? ` / ${v.maxUsage}` : " / ∞"}</span>,
      <span className="text-xs text-muted-foreground" key="d">{v.startsAt ? formatDate(v.startsAt) : "—"} → {v.expiresAt ? formatDate(v.expiresAt) : "∞"}</span>,
      <Badge variant={STATE_VARIANT[v.state] ?? "neutral"} key="st">{STATE_LABEL[v.state] ?? v.state}</Badge>,
      <div className="flex flex-wrap items-center justify-end gap-1" key="a">
        <Link href={sp.edit === v.id ? "/vouchers" : `/vouchers?edit=${v.id}`}><Button size="compact" variant="ghost"><PencilIcon className="h-3.5 w-3.5" /> {sp.edit === v.id ? "Batal" : "Ubah"}</Button></Link>
        <Link href={sp.rid === v.id ? `/vouchers${showAll ? "?showAll=1" : ""}` : `/vouchers${showAll ? "?showAll=1&" : "?"}rid=${v.id}`}>
          <Button size="compact" variant="ghost" className={sp.rid === v.id ? "text-primary" : "text-muted-foreground"}>
            {sp.rid === v.id ? "Tutup riwayat" : "Riwayat"}
          </Button>
        </Link>
        <ActionForm action={toggleVoucherActiveFormAction}>
          <input type="hidden" name="id" value={v.id} />
          <input type="hidden" name="active" value={v.isActive ? "0" : "1"} />
          <Button size="compact" variant="ghost" className="text-muted-foreground"><ArchiveRestoreIcon className="h-3.5 w-3.5" /> {v.isActive ? "Non-aktif" : "Aktif"}</Button>
        </ActionForm>
        <DeleteRowButton id={v.id} action={deleteVouchersAction} title="Hapus voucher ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="Voucher & Promo"
        description="Kode promo: nominal, persen, atau gratis ongkir — kuota, periode berlaku, dan pemakaian per order."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Voucher", value: summary.total },
          { label: "Aktif", value: summary.active },
          { label: "Sedang Berlaku", value: rows.filter((v) => v.state === "AKTIF").length },
          { label: "Terealisasi (x pakai)", value: summary.redeemed },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="font-label-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-2xl font-bold leading-none text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={saveVoucherFormAction} className="flex flex-wrap items-end gap-2">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <input type="hidden" name="editing" value={editing ? "1" : "0"} />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Kode *</p>
              <Input name="code" required minLength={3} defaultValue={editing?.code ?? ""} placeholder="AQIQAH10" className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Tipe</p>
              <select name="type" defaultValue={editing?.type ?? "NOMINAL"} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Nilai nominal (Rp)</p>
              <Input name="nominalAmount" type="number" min={0} defaultValue={editing ? editing.nominalAmount.toString() : 0} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Persen (%)</p>
              <Input name="percentBps" type="number" min={0} max={100} step="0.5" defaultValue={editing ? (editing.percentBps / 100).toString() : 0} className="w-[110px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Maks pakai (kosong = ∞)</p>
              <Input name="maxUsage" type="number" min={1} defaultValue={editing?.maxUsage ?? ""} className="w-[120px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Mulai</p>
              <Input name="startsAt" type="date" defaultValue={editing?.startsAt ? editing.startsAt.toISOString().slice(0, 10) : ""} className="w-[145px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Berakhir</p>
              <Input name="expiresAt" type="date" defaultValue={editing?.expiresAt ? editing.expiresAt.toISOString().slice(0, 10) : ""} className="w-[145px]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <select name="isActive" defaultValue={editing ? (editing.isActive ? "1" : "0") : "1"} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                <option value="1">Aktif</option>
                <option value="0">Non-aktif</option>
              </select>
            </div>
            <Button type="submit">
              {editing ? <PencilIcon className="h-4 w-4" /> : <TicketIcon className="h-4 w-4" />}
              {editing ? "Simpan Perubahan" : "Buat Voucher"}
            </Button>
            {editing && (
              <Link href="/vouchers">
                <Button type="button" variant="ghost">Batal</Button>
              </Link>
            )}
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <TicketIcon className="h-3.5 w-3.5" />
              {rows.length} voucher
            </span>
            <Link href={showAll ? "/vouchers" : "/vouchers?showAll=1"} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              {showAll ? "Sembunyikan non-aktif" : "Tampilkan non-aktif"}
            </Link>
          </div>
                    <RscGrid
            columns={columns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada voucher"
            unit="voucher"
            bulkDelete={{ action: deleteVouchersAction, confirm: "Hapus voucher terpilih?" }}
            exportable={{
              filename: "voucher-promo",
              columns: [{ key: "kode", label: "Kode" }, { key: "tipe", label: "Tipe" }, { key: "nilai", label: "Nilai" }, { key: "pakai", label: "Pakai" }, { key: "periode", label: "Periode" }, { key: "status", label: "Status" }],
              values: rows.map((v) => ({ kode: v.code, tipe: v.type, nilai: voucherValue(v), pakai: v.usedCount, periode: (v.startsAt ? formatDate(v.startsAt) : "-") + " → " + (v.expiresAt ? formatDate(v.expiresAt) : "-"), status: v.state })),
              sheetName: "Voucher",
            }}
          />

        </CardContent>
      </Card>

      {ridRow && (
        <Card className="mt-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm bg-surface/60 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <TicketIcon className="h-3.5 w-3.5" />
                Riwayat pemakaian: {ridRow.code}
              </span>
              <span className="text-xs text-muted-foreground">{redemptions.length} pemakaian terbaru</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Order</TableHead>
                    <TableHead className="text-right">Potongan</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-data text-xs">
                        {r.orderId && r.orderNumber ? (
                          <Link href={`/orders/${r.orderId}`} className="text-primary underline-offset-2 hover:underline">{r.orderNumber}</Link>
                        ) : (r.orderId ? r.orderId.slice(0, 8) : "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-data">{formatIDR(r.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.usedAt)}</TableCell>
                    </TableRow>
                  ))}
                  {redemptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada pemakaian.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
