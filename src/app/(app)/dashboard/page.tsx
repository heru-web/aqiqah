import Link from "next/link";
import { sql } from "drizzle-orm";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { invoices, orders } from "@/db/schema";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { OrdersWeeklyChart, type DayStat } from "@/components/app/orders-weekly-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatIDRShort } from "@/lib/utils";
import { orderCounts, listOrders } from "@/server/services/orders";
import { listLeadsByStatus } from "@/server/services/leads";
import { requirePagePermission } from "@/lib/server/page-auth";
import {
  PlusIcon,
  ShoppingCartIcon,
  TruckIcon,
  Users2Icon,
  WalletIcon,
} from "lucide-react";

function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = "bg-primary/15 text-primary",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="font-label-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold leading-none tracking-tight text-foreground">
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">{sub}</p>}
        </div>
        <div className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-line/10 ${tone}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

async function getDashboardData(branchId: string | undefined) {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startWeekAgo = new Date(startToday);
  startWeekAgo.setDate(startToday.getDate() - 6);
  const endToday = new Date(startToday);
  endToday.setDate(startToday.getDate() + 1);

  const [counts, leadsByStatus] = await Promise.all([
    orderCounts(branchId),
    branchId ? listLeadsByStatus(branchId) : Promise.resolve(undefined),
  ]);

  const [{ today }] = await db
    .select({ today: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(gte(orders.createdAt, startToday), lt(orders.createdAt, endToday)));

  const [{ revenue }] = await db
    .select({ revenue: sql<bigint>`coalesce(sum(${invoices.totalPaid}), 0)` })
    .from(invoices)
    .where(
      and(
        branchId ? eq(invoices.branchId, branchId) : undefined,
        inArray(invoices.status, ["PAID", "PARTIAL"] as (typeof invoices.$inferSelect)["status"][])
      )
    );

  const [{ openInvoices }] = await db
    .select({ openInvoices: sql<number>`count(*)::int` })
    .from(invoices)
    .where(
      and(
        branchId ? eq(invoices.branchId, branchId) : undefined,
        inArray(invoices.status, ["ISSUED", "PARTIAL"] as (typeof invoices.$inferSelect)["status"][])
      )
    );

  const dayRows = await db
    .select({
      day: sql<string>`to_char(${orders.deliveryDate} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(gte(orders.deliveryDate, startToday), lt(orders.deliveryDate, endToday)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const recent = await listOrders({ branchId, page: 1, pageSize: 6 });

  return { counts, leadsByStatus, today: Number(today), revenue, openInvoices: Number(openInvoices), dayRows, recent };
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.home.view");
  const data = await getDashboardData(user.branchId ?? undefined);
  const { counts, leadsByStatus, today, revenue, openInvoices, dayRows, recent } = data;

  const totalOrders = counts.DRAFT + counts.ORDER_CONFIRMED + counts.ANIMALS_SIAAP + counts.SLAUGHTERED + counts.KARKAS_FILLET + counts.KITCHEN_COOKED + counts.PACKED + counts.QC_READY + counts.READY_DISPATCH + counts.DELIVERED + counts.COMPLETED;
  const inProgress = counts.ORDER_CONFIRMED + counts.ANIMALS_SIAAP + counts.SLAUGHTERED + counts.KARKAS_FILLET + counts.KITCHEN_COOKED + counts.PACKED + counts.QC_READY + counts.READY_DISPATCH;

  const chartData: DayStat[] = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(startOfDay());
    d.setDate(d.getDate() - 6 + i);
    const key = toISODate(d);
    const found = dayRows.find((r) => r.day.slice(0, 10) === key);
    return { label: DAY_LABELS[d.getDay()], orders: found ? Number(found.n) : 0 };
  });

  const pipeline = leadsByStatus
    ? [
        { label: "Lead Baru", count: leadsByStatus.LEAD },
        { label: "Minat", count: leadsByStatus.INTERESTED },
        { label: "Penawaran", count: leadsByStatus.QUOTATION },
        { label: "DP Masuk", count: leadsByStatus.DP },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title={`Halo, ${user.name.split(" ")[0]}`}
        description="Ringkasan operasional Madani Aqiqah — waktu nyata dari basis data."
        actions={
          <Link href="/orders/new">
            <Button>
              <PlusIcon className="h-4 w-4" />
              Pesanan Baru
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pesanan Hari Ini" value={String(today)} sub={`Total aktif: ${totalOrders}`} tone="bg-[#b8536c]/15 text-[#b8536c]" icon={<ShoppingCartIcon className="h-5 w-5" />} />
        <MetricCard label="Pendapatan (Lunas)" value={formatIDRShort(revenue)} sub="tagihan lunas + sebagian" icon={<WalletIcon className="h-5 w-5" />} />
        <MetricCard label="Tagihan Belum Lunas" value={String(openInvoices)} sub="terbit & sebagian" tone="bg-[#bd8130]/15 text-[#bd8130]" icon={<TruckIcon className="h-5 w-5" />} />
        <MetricCard label="Dalam Proses" value={String(inProgress)} sub="dari akad sampai siap kirim" tone="bg-[#39678f]/15 text-[#39678f]" icon={<Users2Icon className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pesanan 7 Hari Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersWeeklyChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline CRM</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada cabang/lead.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pipeline.map((p) => (
                  <li key={p.label} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-foreground">{p.label}</span>
                    <Badge variant="gold">{p.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pesanan Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Pesanan</TableHead>
                <TableHead>Shohibul</TableHead>
                <TableHead>Tanggal Kirim</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Belum ada pesanan.
                  </TableCell>
                </TableRow>
              ) : (
                recent.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/orders/${r.id}`} className="font-semibold text-primary hover:underline">
                        {r.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{r.shohibulName ?? r.customerName}</TableCell>
                    <TableCell>{formatDate(r.deliveryDate)}</TableCell>
                    <TableCell>
                      <StatusBadge kind="order" status={r.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatIDRShort(r.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}