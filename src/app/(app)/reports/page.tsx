import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { TableExportButtons } from "@/components/app/table-export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIDR } from "@/lib/utils";
import { FinanceTrendChart } from "@/components/reports/finance-trend-chart";
import { accountBalances, cashFlow, cashFlowSegments, generalLedger } from "@/server/services/reports";
import { monthlyFinanceTrend, topProducts } from "@/server/services/bi";
import { listPeriodClosings } from "@/server/services/periods";
import { listAccountsWithOpenings, listBranchesSimple } from "@/server/services/openings";
import { saveAccountOpeningsFormAction } from "@/server/actions/openings";
import { closePeriodFormAction, reopenPeriodFormAction } from "@/server/actions/ops-extra";
import { listBranches } from "@/server/services/settings";
import { can } from "@/lib/permissions";
import { requirePagePermission } from "@/lib/server/page-auth";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string; ob?: string }>;
}) {
  const user = await requirePagePermission("reports.reports.view");
  const sp = await searchParams;
  const now = new Date();
  const from = sp.from ? new Date(sp.from + "T00:00:00") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return <p className="p-6 text-sm text-danger">Rentang tanggal tidak valid.</p>;
  }

  const branches = await listBranches();
  const canManageOpenings = can(user.permissions, "branches.branches.update");
  const obId: string | undefined = sp.ob && branches.some((b) => b.id === sp.ob) ? sp.ob : undefined;
  const branchId =
    user.branchId ??
    (sp.branch && branches.some((b) => b.id === sp.branch) ? sp.branch : undefined);
  const branchName = branches.find((b) => b.id === branchId)?.name;

  const [balances, ledger, cash, trend, products, segments, closings, openingData] = await Promise.all([
    accountBalances(from, to, branchId),
    generalLedger(from, to, branchId),
    cashFlow(from, to, branchId),
    monthlyFinanceTrend(branchId, 12),
    topProducts({ branchId, from, to, limit: 8 }),
    cashFlowSegments(from, to, branchId),
    listPeriodClosings(),
    canManageOpenings
      ? listBranchesSimple().then((bs) =>
          bs.length === 0 || !obId
            ? { bs, openings: [] as Array<{ accountId: string; code: string; name: string; opening: bigint }> }
            : listAccountsWithOpenings(obId).then((openings) => ({ bs, openings }))
        )
      : Promise.resolve({ bs: [] as Array<{ id: string; name: string }>, openings: [] as Array<{ accountId: string; code: string; name: string; opening: bigint }> }),
  ]);

  const { bs, openings } = openingData;
  const openingsEnabled = true;

  // ── Laba Rugi (periode) ──
  const pendapatan = balances.filter((b) => b.type === "INCOME" && (b.period !== 0n || b.cumulative !== 0n));
  const beban = balances.filter((b) => b.type === "EXPENSE" && (b.period !== 0n || b.cumulative !== 0n));
  const totalPendapatan = pendapatan.reduce((acc, b) => acc + (b.type === "INCOME" ? -b.period : 0n), 0n);
  const totalBeban = beban.reduce((acc, b) => acc + (b.type === "EXPENSE" ? b.period : 0n), 0n);
  const labaBersih = totalPendapatan - totalBeban;
  const lrRows = [
    ...pendapatan.map((b) => ({ kategori: "Pendapatan", akun: `${b.code} ${b.name}`, jumlah: formatIDR(-b.period) })),
    { kategori: "Pendapatan", akun: "TOTAL PENDAPATAN", jumlah: formatIDR(totalPendapatan) },
    ...beban.map((b) => ({ kategori: "Beban", akun: `${b.code} ${b.name}`, jumlah: formatIDR(b.period) })),
    { kategori: "Beban", akun: "TOTAL BEBAN", jumlah: formatIDR(totalBeban) },
    { kategori: "Hasil", akun: "LABA BERSIH", jumlah: formatIDR(labaBersih) },
  ];

  // ── Neraca (kumulatif hingga `to`) ──
  const aset = balances.filter((b) => b.type === "ASSET" && b.cumulative !== 0n);
  const kewajiban = balances.filter((b) => b.type === "LIABILITY" && b.cumulative !== 0n);
  const ekuitas = balances.filter((b) => b.type === "EQUITY" && b.cumulative !== 0n);
  const totalAset = aset.reduce((a, b) => a + b.cumulative, 0n);
  const totalKewajiban = kewajiban.reduce((a, b) => a + -b.cumulative, 0n);
  const labaKumulatif = balances.filter((b) => b.type === "INCOME" || b.type === "EXPENSE").reduce((sum, b) => sum - b.cumulative, 0n);
  const totalEkuitas = ekuitas.reduce((a, b) => a - b.cumulative, 0n) + labaKumulatif;
  const nerRows = [
    ...aset.map((b) => ({ sisi: "ASET", akun: `${b.code} ${b.name}`, jumlah: formatIDR(b.cumulative) })),
    { sisi: "ASET", akun: "TOTAL ASET", jumlah: formatIDR(totalAset) },
    ...kewajiban.map((b) => ({ sisi: "KEWAJIBAN", akun: `${b.code} ${b.name}`, jumlah: formatIDR(-b.cumulative) })),
    { sisi: "KEWAJIBAN", akun: "TOTAL KEWAJIBAN", jumlah: formatIDR(totalKewajiban) },
    ...ekuitas.map((b) => ({ sisi: "EKUITAS", akun: `${b.code} ${b.name}`, jumlah: formatIDR(-b.cumulative) })),
    { sisi: "EKUITAS", akun: "Laba ditahan dan berjalan (kumulatif)", jumlah: formatIDR(labaKumulatif) },
    { sisi: "EKUITAS", akun: "TOTAL EKUITAS (termasuk laba periode)", jumlah: formatIDR(totalEkuitas) },
  ];

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={`Laba Rugi, Neraca, Arus Kas & Buku Besar — dari jurnal terposting${branchName ? ` · cabang ${branchName}` : " · semua cabang"}.`}
        actions={null}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form action="/reports" method="GET" className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Dari</p>
              <Input type="date" name="from" defaultValue={fmtDate(from)} className="w-[150px]" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Sampai</p>
              <Input type="date" name="to" defaultValue={fmtDate(to)} className="w-[150px]" />
            </div>
            {!user.branchId && branches.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Cabang</p>
                <select name="branch" defaultValue={branchId ?? ""} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                  <option value="">Semua cabang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit" variant="secondary">Terapkan</Button>
          </form>
          <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
            <Link href="#bi" className="hover:text-foreground">BI</Link>
            <Link href="#laba-rugi" className="hover:text-foreground">Laba Rugi</Link>
            <Link href="#neraca" className="hover:text-foreground">Neraca</Link>
            <Link href="#arus-kas" className="hover:text-foreground">Arus Kas</Link>
            <Link href="#arus-kas-segmen" className="hover:text-foreground">Kas Segmen</Link>
            <Link href="#buku-besar" className="hover:text-foreground">Buku Besar</Link>
          </div>
        </CardContent>
      </Card>

      {branchId && (
        <p className="mb-4 rounded-lg bg-surface/60 px-3 py-2 text-xs text-muted-foreground ring-1 ring-line/10">
          Laporan per cabang memakai mutasi jurnal cabang tersebut. Saldo awal akun (opening balance) bersifat konsolidasi dan tidak dialokasikan per cabang, sehingga dianggap 0 pada tampilan ini.
        </p>
      )}

      {/* ── Business Intelligence ── */}
      <section id="bi" className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-foreground">Business Intelligence</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Tren Pendapatan, Beban & Laba (12 bulan)</CardTitle>
            </CardHeader>
            <CardContent>
              <FinanceTrendChart data={trend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris (periode)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.description}>
                      <TableCell className="max-w-[220px] truncate text-xs" title={p.description}>{p.description}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{p.qty}</TableCell>
                      <TableCell className="text-right font-data text-xs">{formatIDR(BigInt(p.revenue))}</TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada penjualan pada rentang ini.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Laba Rugi ── */}
      <section id="laba-rugi" className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-foreground">Laba Rugi</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{pendapatan.length + beban.length} akun</span>
              <TableExportButtons
                filename={`laba-rugi-${fmtDate(from)}`}
                columns={[
                  { key: "kategori", label: "Kategori" },
                  { key: "akun", label: "Akun" },
                  { key: "jumlah", label: "Jumlah" },
                ]}
                rows={lrRows}
                sheetName="Laba Rugi"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Kategori</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lrRows.map((r, i) => (
                  <TableRow key={i} className={r.akun.startsWith("TOTAL") || r.akun.startsWith("LABA") ? "bg-table-stripe font-semibold" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{r.kategori}</TableCell>
                    <TableCell>{r.akun}</TableCell>
                    <TableCell className="text-right font-data">{r.jumlah}</TableCell>
                  </TableRow>
                ))}
                {lrRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada data pada rentang ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Neraca ── */}
      <section id="neraca" className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-foreground">Neraca</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{aset.length + kewajiban.length + ekuitas.length} akun</span>
              <TableExportButtons
                filename={`neraca-${fmtDate(to)}`}
                columns={[
                  { key: "sisi", label: "Sisi" },
                  { key: "akun", label: "Akun" },
                  { key: "jumlah", label: "Jumlah" },
                ]}
                rows={nerRows}
                sheetName="Neraca"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Sisi</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nerRows.map((r, i) => (
                  <TableRow key={i} className={r.akun.startsWith("TOTAL") ? "bg-table-stripe font-semibold" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{r.sisi}</TableCell>
                    <TableCell>{r.akun}</TableCell>
                    <TableCell className="text-right font-data">{r.jumlah}</TableCell>
                  </TableRow>
                ))}
                {nerRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Belum ada data pada rentang ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Arus Kas ── */}
      <section id="arus-kas" className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-foreground">Arus Kas (akun 1-11xx)</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{cash.length} akun kas</span>
              <TableExportButtons
                filename={`arus-kas-${fmtDate(from)}`}
                columns={[
                  { key: "code", label: "Kode" },
                  { key: "name", label: "Akun" },
                  { key: "masuk", label: "Masuk" },
                  { key: "keluar", label: "Keluar" },
                  { key: "net", label: "Netto" },
                ]}
                rows={cash.map((c) => ({
                  code: c.code,
                  name: c.name,
                  masuk: formatIDR(BigInt(String(c.debit))),
                  keluar: formatIDR(BigInt(String(c.credit))),
                  net: formatIDR(c.net),
                }))}
                sheetName="Arus Kas"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Akun Kas</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Keluar</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cash.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-data text-xs text-primary">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(BigInt(String(c.debit)))}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(BigInt(String(c.credit)))}</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatIDR(c.net)}</TableCell>
                  </TableRow>
                ))}
                {cash.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada pergerakan kas pada rentang ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Arus Kas Segmen ── */}
      <section id="arus-kas-segmen" className="mb-6">
        <h2 className="mb-2 text-lg font-bold text-foreground">Arus Kas per Segmen (klasifikasi sederhana)</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{segments.filter((x) => x.masuk !== 0n || x.keluar !== 0n).length} segmen bergerak</span>
              <TableExportButtons
                filename={`kas-segmen-${fmtDate(from)}`}
                columns={[
                  { key: "segment", label: "Segmen" },
                  { key: "masuk", label: "Masuk" },
                  { key: "keluar", label: "Keluar" },
                  { key: "net", label: "Netto" },
                ]}
                rows={segments.map((s) => ({
                  segment: s.segment,
                  masuk: formatIDR(s.masuk),
                  keluar: formatIDR(s.keluar),
                  net: formatIDR(s.net),
                }))}
                sheetName="Kas Segmen"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segmen</TableHead>
                  <TableHead className="text-right">Masuk</TableHead>
                  <TableHead className="text-right">Keluar</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((s) => (
                  <TableRow key={s.segment}>
                    <TableCell>
                      <p className="font-semibold text-foreground">{s.segment === "OPERASI" ? "Operasional" : s.segment === "INVESTASI" ? "Investasi" : "Pendanaan"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.segment === "OPERASI"
                          ? "akun pendapatan/beban/piutang/utang usaha"
                          : s.segment === "INVESTASI"
                            ? "akun aset tetap (1-2xxx)"
                            : "akun modal (3-xxx) & pinjaman (2-2xxx)"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-data tabular-nums">{formatIDR(s.masuk)}</TableCell>
                    <TableCell className="text-right font-data tabular-nums">{formatIDR(s.keluar)}</TableCell>
                    <TableCell className="text-right font-data tabular-nums font-semibold">{formatIDR(s.net)}</TableCell>
                  </TableRow>
                ))}
                {segments.every((s) => s.masuk === 0n && s.keluar === 0n) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada pergerakan kas pada rentang ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Klasifikasi otomatis dari akun lawan jurnal kas: pendapatan/beban/piutang dan utang usaha dianggap operasional, aset tetap dianggap investasi, modal dan pinjaman dianggap pendanaan. Transfer kas antar kas/bank tidak dihitung agar tidak dobel.
        </p>
      </section>

      {/* ── Buku Besar ── */}
      <section id="buku-besar" className="mb-10">
        <h2 className="mb-2 text-lg font-bold text-foreground">Buku Besar (jurnal terposting, terbaru 400)</h2>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
              <span className="text-xs font-medium text-muted-foreground">{ledger.length} baris</span>
              <TableExportButtons
                filename={`buku-besar-${fmtDate(from)}`}
                columns={[
                  { key: "tgl", label: "Tanggal" },
                  { key: "no", label: "No. Jurnal" },
                  { key: "acc", label: "Akun" },
                  { key: "ket", label: "Keterangan" },
                  { key: "debit", label: "Debit" },
                  { key: "credit", label: "Kredit" },
                ]}
                rows={ledger.map((l) => ({
                  tgl: l.journalDate.toISOString().slice(0, 10),
                  no: l.journalNumber,
                  acc: l.accountCode + " " + l.accountName,
                  ket: l.description ?? "",
                  debit: formatIDR(BigInt(String(l.debit))),
                  credit: formatIDR(BigInt(String(l.credit))),
                }))}
                sheetName="Buku Besar"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Jurnal</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Kredit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{l.journalDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="font-data text-xs">{l.journalNumber}</TableCell>
                    <TableCell>{l.accountCode} · {l.accountName}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(BigInt(String(l.debit)))}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(BigInt(String(l.credit)))}</TableCell>
                  </TableRow>
                ))}
                {ledger.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada jurnal terposting pada rentang ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Saldo awal per cabang (hanya superadmin/global) ── */}
      {canManageOpenings && openingsEnabled && (
        <section id="saldo-awal" className="mb-6">
          <h2 className="mb-2 text-lg font-bold text-foreground">Saldo Awal Akun per Cabang</h2>
          <Card className="mb-3">
            <CardContent className="p-4">
              <form action="/reports" method="GET" className="flex flex-wrap items-end gap-2">
                {sp.branch && <input type="hidden" name="branch" value={sp.branch} />}
                {sp.from && <input type="hidden" name="from" value={sp.from} />}
                {sp.to && <input type="hidden" name="to" value={sp.to} />}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Cabang</p>
                  <select name="ob" defaultValue={obId ?? ""} className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
                    <option value="">— pilih cabang —</option>
                    {bs.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="secondary">Muat</Button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">Nilai dianggap <b>saldo netral bertanda</b>: debit positif, kredit/kewajiban negative (contoh utang −1.000.000). Neraca per cabang memakai nilai ini sebagai saldo awal akun.</p>
            </CardContent>
          </Card>
          {obId && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b border-line-warm bg-surface/60 px-3 py-2.5">
                  <form action={saveAccountOpeningsFormAction}>
                    <input type="hidden" name="branchId" value={obId} />
                    <div className="max-h-[52vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[130px]">Kode</TableHead>
                            <TableHead>Akun</TableHead>
                            <TableHead className="text-right">Saldo Awal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openings.map((o) => (
                            <TableRow key={o.accountId}>
                              <TableCell className="font-data text-xs text-primary">{o.code}</TableCell>
                              <TableCell>{o.name}</TableCell>
                              <TableCell className="text-right">
                                <Input name={`opening_${o.accountId}`} defaultValue={Number(o.opening) || ""} type="number" inputMode="numeric" className="ml-auto h-8 w-[170px] text-right font-data text-xs" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-line-warm px-3 py-2.5">
                      <Button type="submit" size="compact" variant="secondary">Simpan Saldo Awal</Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ── Tutup Periode ── */}
      {(can(user.permissions, "accounting.posting.create") || can(user.permissions, "accounting.posting.update")) && (
        <section id="tutup-periode" className="mb-10">
          <h2 className="mb-2 text-lg font-bold text-foreground">Tutup Periode Akuntansi</h2>
          <Card className="mb-3">
            <CardContent className="p-4">
              <form action={closePeriodFormAction} className="flex flex-wrap items-end gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Periode (YYYY-MM)</p>
                  <Input name="period" required pattern="\d{4}-\d{2}" defaultValue={`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`} className="w-[130px]" />
                </div>
                <div className="min-w-[240px] flex-1">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Catatan</p>
                  <Input name="note" placeholder="mis. tutup 9 Nov — rekonsiliasi VA selesai" />
                </div>
                <Button type="submit" variant="secondary">Tutup Periode</Button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">Periode tertutup menolak <em>posting jurnal manual</em> pada bulan tersebut; jurnal otomatis operasional tetap berjalan.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
                <span className="text-xs font-medium text-muted-foreground">{closings.length} periode tertutup</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead>Ditutup</TableHead>
                      <TableHead>Oleh</TableHead>
                      <TableHead>Catatan</TableHead>
                      {can(user.permissions, "accounting.posting.update") && <TableHead className="text-right">Aksi</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closings.map((c) => (
                      <TableRow key={c.closing.id}>
                        <TableCell className="font-data font-semibold">{c.closing.period}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.closing.closedAt.toISOString().slice(0, 16).replace("T", " ")}</TableCell>
                        <TableCell className="text-xs">{c.userName ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.closing.note ?? "—"}</TableCell>
                        {can(user.permissions, "accounting.posting.update") && (
                          <TableCell>
                            <form action={reopenPeriodFormAction} className="flex items-center justify-end gap-1.5">
                              <input type="hidden" name="id" value={c.closing.id} />
                              <Input name="reason" placeholder="alasan buka ulang" className="h-8 w-[150px] text-xs" />
                              <Button size="compact" variant="ghost" type="submit">Buka ulang</Button>
                            </form>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {closings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada periode yang ditutup.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
