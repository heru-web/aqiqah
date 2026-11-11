import { ActionForm } from "@/components/app/action-form";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableExportButtons } from "@/components/app/table-export";
import { createKasbonVoidAction, changeKasbonStatusVoidAction } from "@/server/actions/erp";
import { listKasbons } from "@/server/services/erp";
import { listEmployees } from "@/server/services/hr";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatIDR } from "@/lib/utils";
import { HandCoinsIcon } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENGAJUAN: "pengajuan",
  DISETUJUI: "disetujui",
  DIBAYAR: "dibayar",
  DIBATALKAN: "dibatalkan",
};

export default async function KasbonPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePagePermission("kasbon.kasbon.view");
  const sp = await searchParams;
  const [employees, kasbons] = await Promise.all([listEmployees({ branchId: user.branchId }), listKasbons(user, sp.status)]);

  return (
    <div>
      <PageHeader
        title="Kasbon"
        description="Pengajuan uang muka karyawan: pengajuan → disetujui → dibayar / dibatalkan."
        actions={null}
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <ActionForm action={createKasbonVoidAction} className="flex flex-wrap items-end gap-2">
            <select name="employeeId" required className="h-10 rounded-xl bg-surface/60 px-3 text-sm ring-1 ring-line/15">
              <option value="">Pilih karyawan…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.employeeNumber} · {e.name}</option>
              ))}
            </select>
            <Input name="amount" type="number" min={1} required placeholder="Nominal (Rp)" className="w-[160px]" />
            <Input name="reason" placeholder="Alasan" className="w-[200px]" />
            <Button type="submit">
              <HandCoinsIcon className="h-4 w-4" />
              Ajukan
            </Button>
          </ActionForm>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Link href="/kasbon" className={`rounded-full px-2.5 py-1 ring-1 ${!sp.status ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>Semua</Link>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <Link key={k} href={`/kasbon?status=${k}`} className={`rounded-full px-2.5 py-1 ring-1 ${sp.status === k ? "ring-primary/40 bg-primary/10 text-primary" : "ring-line/15 text-muted-foreground"}`}>{v}</Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line-warm px-3 py-2.5 bg-surface/60">
            <span className="text-xs font-medium text-muted-foreground">{kasbons.length} kasbon</span>
            <TableExportButtons
              filename="kasbon"
              columns={[
                { key: "employeeNumber", label: "NIP" },
                { key: "employeeName", label: "Nama" },
                { key: "amount", label: "Nominal" },
                { key: "reason", label: "Alasan" },
                { key: "status", label: "Status" },
              ]}
              rows={kasbons.map((k) => ({
                employeeNumber: k.employeeNumber,
                employeeName: k.employeeName,
                amount: formatIDR(k.amount),
                reason: k.reason ?? "",
                status: STATUS_LABEL[k.status] ?? k.status,
              }))}
              sheetName="Kasbon"
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIP</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kasbons.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-data text-xs">{k.employeeNumber}</TableCell>
                    <TableCell>{k.employeeName}</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(k.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{k.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={k.status === "DIBAYAR" ? "success" : k.status === "DIBATALKAN" ? "neutral" : k.status === "DISETUJUI" ? "info" : "warning"}>
                        {STATUS_LABEL[k.status] ?? k.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {k.status === "PENGAJUAN" && (
                          <ActionForm action={changeKasbonStatusVoidAction}>
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="status" value="DISETUJUI" />
                            <Button type="submit" size="compact" variant="outline">Setujui</Button>
                          </ActionForm>
                        )}
                        {k.status === "DISETUJUI" && (
                          <ActionForm action={changeKasbonStatusVoidAction}>
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="status" value="DIBAYAR" />
                            <Button type="submit" size="compact" variant="success">Tandai Dibayar</Button>
                          </ActionForm>
                        )}
                        {k.status !== "DIBAYAR" && (
                          <ActionForm action={changeKasbonStatusVoidAction}>
                            <input type="hidden" name="id" value={k.id} />
                            <input type="hidden" name="status" value="DIBATALKAN" />
                            <Button type="submit" size="compact" variant="ghost" className="text-muted-foreground" title="Batalkan">Batal</Button>
                          </ActionForm>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {kasbons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Belum ada kasbon pada filter ini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
