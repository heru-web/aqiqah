import { PageHeader } from "@/components/app/page-header";
import { MarketingSpendForm } from "@/components/performance/marketing-spend-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listMarketingSpends, listSalesChannels } from "@/server/services/performance";
import { runFormula, type FormulaCtx } from "@/server/services/kpi-formulas";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatIDRShort } from "@/lib/utils";

export default async function MarketingPage() {
  const user = await requirePagePermission("performance.master.view");
  const branchId = user.branchId ?? undefined;
  const channels = await listSalesChannels();
  const spends = await listMarketingSpends(branchId ?? undefined);

  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

  const attribution = [];
  for (const channel of channels) {
    const ctx: FormulaCtx = {
      start: periodStart,
      end: periodEnd,
      branchId: branchId ?? undefined,
      scope: "CHANNEL",
      scopeRefId: channel.id,
    };
    const [cac, roas, leads, revenue] = await Promise.all([
      runFormula("channel_cac", ctx),
      runFormula("channel_roas", ctx),
      runFormula("channel_leads", ctx),
      runFormula("channel_revenue", ctx),
    ]);
    attribution.push({ channel, cac, roas, leads, revenue });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Iklan & Kampanye"
        description="Catat spend iklan per saluran dan pantau atribusi: spend → leads → CAC, spend → revenue → ROAS."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {attribution.map(({ channel, cac, roas, leads, revenue }) => (
          <Card key={channel.id}>
            <CardHeader>
              <CardTitle className="text-base">{channel.name}</CardTitle>
              <CardDescription>
                {channel.type === "ONLINE" ? "Online" : "Offline"} · {channel.code}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Spend</span>
                <span className="font-semibold">{formatIDRShort(spends.find((s) => s.channelId === channel.id)?.amount ?? 0n)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Leads</span>
                <span className="font-semibold">{leads ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pendapatan</span>
                <span className="font-semibold">{revenue === null ? "—" : formatIDRShort(revenue)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">CAC</span>
                <span className="font-semibold">{cac === null ? "—" : formatIDRShort(cac)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ROAS</span>
                <span className="font-semibold">{roas === null ? "—" : roas.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input Spend Iklan</CardTitle>
          <CardDescription>Catat pengeluaran iklan per saluran per periode.</CardDescription>
        </CardHeader>
        <CardContent>
          <MarketingSpendForm channels={channels} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Saluran</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Belum ada data spend iklan.
                  </TableCell>
                </TableRow>
              ) : (
                spends.map((spend) => (
                  <TableRow key={spend.id}>
                    <TableCell>{spend.channelName}</TableCell>
                    <TableCell>
                      {spend.periodStart} → {spend.periodEnd}
                    </TableCell>
                    <TableCell className="text-right">{formatIDRShort(spend.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{spend.notes ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Badge variant="outline">Periode: {periodStart} → {periodEnd}</Badge>
      </div>
    </div>
  );
}
