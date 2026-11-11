import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RscGrid, type RscColumn, type RscRow } from "@/components/app/rsc-grid";
import { RowEditDialog, DeleteRowButton } from "@/components/app/table-extras";
import { deleteZiswafAction, updateZiswafFormAction } from "@/server/actions/table-ops";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createZiswafVoidAction } from "@/server/actions/erp";
import { listZiswaf, ziswafSummary } from "@/server/services/erp";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDate, formatIDR } from "@/lib/utils";
import { HeartHandshakeIcon } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  ZAKAT: "Zakat",
  INFAK: "Infak",
  SEDEKAH: "Sedekah",
  WAKAF: "Wakaf",
};

export default async function ZiswafPage() {
  const user = await requirePagePermission("ziswaf.ziswaf.view");
  const [summary, entries] = await Promise.all([ziswafSummary(user), listZiswaf(user)]);


  const rscColumns: RscColumn[] = [
    { key: "tgl", header: "Tanggal" },
    { key: "jenis", header: "Jenis" },
    { key: "arah", header: "Arah" },
    { key: "pihak", header: "Pihak" },
    { key: "jumlah", header: "Jumlah", align: "right" },
    { key: "catatan", header: "Catatan" },
    { key: "aksi", header: "Aksi", align: "right" },
  ];

  const gridRows: RscRow[] = entries.map((z) => ({
    id: z.id,
    cells: [
      <span className="text-xs text-muted-foreground" key="t">{z.eventDate ? formatDate(z.eventDate) : "—"}</span>,
      <Badge variant={z.kind === "ZAKAT" ? "gold" : "neutral"} key="j">{KIND_LABEL[z.kind] ?? z.kind}</Badge>,
      <Badge variant={z.direction === "IN" ? "success" : "danger"} key="a">{z.direction === "IN" ? "Masuk" : "Keluar"}</Badge>,
      <span className="text-sm text-foreground" key="p">{z.party}</span>,
      <span className="tabular-nums font-data" key="n">{formatIDR(z.amount)}</span>,
      <span className="text-xs text-muted-foreground" key="c">{z.note ?? "—"}</span>,
      <div className="flex items-center justify-end gap-1" key="x">
        <RowEditDialog
          title={"Ubah entri " + (KIND_LABEL[z.kind] ?? z.kind)}
          description="Perbarui jumlah, pihak, atau catatan entri ZISWAF."
          action={updateZiswafFormAction}
          fields={(
            <>
              <input type="hidden" name="id" value={z.id} />
              <input name="amount" type="number" defaultValue={Number(z.amount)} className="h-9 w-full rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
              <input name="party" defaultValue={z.party} className="h-9 w-full rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
              <input name="note" defaultValue={z.note ?? ""} className="h-9 w-full rounded-xl bg-surface/70 px-3 text-sm ring-1 ring-line" />
            </>
          )}
        />
        <DeleteRowButton id={z.id} action={deleteZiswafAction} title="Hapus entri ZISWAF ini?" />
      </div>,
    ],
  }));

  return (
    <div>
      <PageHeader
        title="ZISWAF"
        description="Zakat, Infak, Sedekah & Wakaf — penerimaan (muzakki) dan penyaluran (mustahik)."
        actions={null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["ZAKAT", "INFAK", "SEDEKAH", "WAKAF"] as const).map((kind) => {
          const s = summary.find((x) => x.kind === kind);
          return (
            <Card key={kind}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[kind]}</p>
                <p className="mt-1 font-display text-lg font-bold text-foreground">{formatIDR(s?.saldo ?? 0n)}</p>
                <p className="text-[11px] text-muted-foreground">
                  masuk {formatIDR(s?.masuk ?? 0n)} · keluar {formatIDR(s?.keluar ?? 0n)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createZiswafVoidAction} className="flex flex-wrap items-end gap-2">
            <select name="kind" defaultValue="ZAKAT" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select name="direction" defaultValue="IN" className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
              <option value="IN">Penerimaan (IN)</option>
              <option value="OUT">Penyaluran (OUT)</option>
            </select>
            <Input name="amount" type="number" min={1} required placeholder="Nominal (Rp)" className="w-[150px]" />
            <Input name="party" required placeholder="Nama (muzakki/mustahik)" className="w-[220px]" />
            <Input name="eventDate" type="date" className="w-[150px]" />
            <Input name="note" placeholder="Catatan" className="w-[160px]" />
            <Button type="submit">
              <HeartHandshakeIcon className="h-4 w-4" />
              Simpan
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <span className="text-xs font-medium text-muted-foreground">{entries.length} entri</span>
          </div>
                    <RscGrid
            columns={rscColumns}
            rows={gridRows}
            selectable
            emptyTitle="Belum ada entri ZISWAF"
            unit="entri"
            bulkDelete={{ action: deleteZiswafAction, confirm: "Hapus entri terpilih?" }}
            exportable={{
              filename: "ziswaf",
              columns: [{ key: "tanggal", label: "Tanggal" }, { key: "jenis", label: "Jenis" }, { key: "arah", label: "Arah" }, { key: "pihak", label: "Pihak" }, { key: "jumlah", label: "Jumlah" }, { key: "catatan", label: "Catatan" }],
              values: entries.map((z) => ({ tanggal: z.eventDate ? z.eventDate.toISOString().slice(0, 10) : "", jenis: z.kind, arah: z.direction, pihak: z.party, jumlah: z.amount.toString(), catatan: z.note ?? "" })),
              sheetName: "ZISWAF",
            }}
          />

        </CardContent>
      </Card>
    </div>
  );
}
