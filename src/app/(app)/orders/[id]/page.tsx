import { assertResourceAccess } from "@/lib/server/resource-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { OrderTransitions, RegisterPaymentButton } from "@/components/orders/order-detail-actions";
import { getOrderDetail } from "@/server/services/orders";
import { requirePagePermission } from "@/lib/server/page-auth";
import { formatDateTime, formatIDR } from "@/lib/utils";
import { ORDER_STATUS_LABELS, AQIQAH_TYPE_LABELS, DELIVERY_TIME_SLOT_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("orders.orders.view");
  const { id } = await params;
  await assertResourceAccess("order", id, user);
  const { order, customer, items, statusLogs, invoice } = await getOrderDetail(id);

  if (!order) notFound();
  if (user.branchId && order.branchId !== user.branchId) notFound();

  const progress = ["DRAFT", "ORDER_CONFIRMED", "ANIMALS_SIAAP", "SLAUGHTERED", "KARKAS_FILLET", "KITCHEN_COOKED", "PACKED", "QC_READY", "READY_DISPATCH", "DELIVERED", "COMPLETED"];
  const currentIdx = progress.indexOf(order.status);

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        description={customer ? `${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}` : "Pelanggan dihapus"}
        actions={
          <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="mr-1 inline h-4 w-4" /> Semua order
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge kind="order" status={order.status} />
        {order.balance > 0n ? (
          <Badge variant="danger" className="font-data">Sisa {formatIDR(order.balance)}</Badge>
        ) : (
          <Badge variant="success">Lunas</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Info Order</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoItem label="Rujukan / Referal" value={order.referralSource ?? "—"} />
              <InfoItem label="Dibuat" value={formatDateTime(order.createdAt)} />
              <InfoItem label="Status" value={ORDER_STATUS_LABELS[order.status]} />
              <InfoItem label="Jenis Aqiqah" value={AQIQAH_TYPE_LABELS[order.aqiqahType] ?? order.aqiqahType} />
              <InfoItem label="Shohibul" value={order.shohibulName ?? "—"} />
              <InfoItem label="Nama anak" value={order.childName ?? "—"} />
              <InfoItem label="Tgl lahir" value={order.bornDate ? formatDateTime(order.bornDate) : "—"} />
              <InfoItem label="Hari ke-" value={order.aqiqahDay ? `${order.aqiqahDay} hari` : "—"} />
              {order.aqiqahDate && (
                <InfoItem label="Tgl aqiqah" value={formatDateTime(order.aqiqahDate)} />
              )}
            </CardContent>
          </Card>

          {order.deliveryAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4" /> Pengiriman
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoItem label="Tgl kirim" value={order.deliveryDate ? formatDateTime(order.deliveryDate) : "—"} />
                <InfoItem label="Sesi" value={DELIVERY_TIME_SLOT_LABELS[order.deliveryTimeSlot ?? ""] ?? order.deliveryTimeSlot ?? "—"} />
                <InfoItem label="Penerima" value={order.recipientName ?? "—"} />
                <InfoItem label="Telepon" value={order.recipientPhone ?? "—"} />
                <InfoItem className="sm:col-span-2" label="Alamat" value={order.deliveryAddress} />
                <InfoItem label="Kota" value={order.deliveryCity ?? "—"} />
                <InfoItem label="Kecamatan" value={order.deliveryDistrict ?? "—"} />
                {order.deliveryLandmark && <InfoItem label="Landmark" value={order.deliveryLandmark} />}
                {order.deliveryNote && <InfoItem label="Catatan kurir" value={order.deliveryNote} />}
                <InfoItem label="Ongkir" value={order.shippingAmount > 0n ? formatIDR(order.shippingAmount) : "Gratis"} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Item Pesanan</CardTitle>
              <CardDescription>Harga dibekukan saat order dibuat.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{it.description}</p>
                        <Badge variant={it.kind === "PAKET" ? "gold" : "neutral"} className="mt-0.5">
                          {it.kind === "PAKET" ? "Paket" : "Barang"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-data">{it.quantity}</TableCell>
                      <TableCell className="text-right font-data">{formatIDR(it.unitPrice)}</TableCell>
                      <TableCell className="text-right font-data">
                        {it.discountBps > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            <span className="mr-1 line-through">{formatIDR(it.unitPrice * BigInt(it.quantity))}</span>
                            {formatIDR(it.unitPrice * BigInt(it.quantity) - (it.unitPrice * BigInt(it.quantity) * BigInt(it.discountBps)) / 100n)}
                          </span>
                        ) : (
                          formatIDR(it.unitPrice * BigInt(it.quantity))
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(order.itemsTotal)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Diskon</TableCell>
                    <TableCell className="text-right font-data">- {formatIDR(order.discountAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Ongkir</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(order.shippingAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-headline-sm text-foreground">Total</TableCell>
                    <TableCell className="text-right font-headline-sm text-foreground">{formatIDR(order.total)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Terbayar (terkonfirmasi)</TableCell>
                    <TableCell className="text-right font-data">{formatIDR(order.paidConfirmed)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Sisa</TableCell>
                    <TableCell className="text-right font-data text-danger">{formatIDR(order.balance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Catatan Order</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {progress.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        i < currentIdx
                          ? "bg-primary text-primary-foreground"
                          : i === currentIdx
                            ? "bg-gold text-gold-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i < currentIdx ? "✓" : i + 1}
                    </span>
                    <span className={`text-xs ${i <= currentIdx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {ORDER_STATUS_LABELS[s]}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="my-4 h-px bg-border" />

              <OrderTransitions orderId={order.id} status={order.status} />

              {invoice && (
                <div className="mt-4">
                  <Link href={`/invoices/${invoice.id}`} className="text-sm text-primary hover:underline">
                    Lihat invoice {invoice.invoiceNumber} →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-data">{formatIDR(order.total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Terbayar</span>
                <span className="font-data">{formatIDR(order.paidConfirmed)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sisa</span>
                <span className="font-data text-danger">{formatIDR(order.balance)}</span>
              </div>
              <RegisterPaymentButton
                invoiceId={invoice?.id ?? null}
                orderId={order.id}
                amount={order.balance}
                disabled={["COMPLETED", "CANCELLED"].includes(order.status)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat Status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusLogs.length === 0 ? (
                <EmptyState title="Belum ada riwayat" />
              ) : (
                <ol className="space-y-3">
                  {[...statusLogs].reverse().map((l) => (
                    <li key={l.id} className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="neutral">{ORDER_STATUS_LABELS[l.toStatus]}</Badge>
                        {l.fromStatus && (
                          <span className="text-xs text-muted-foreground">dari {ORDER_STATUS_LABELS[l.fromStatus]}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(l.createdAt)}
                        {l.reason ? ` — ${l.reason}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {order.voucherId && (
            <Card>
              <CardHeader>
                <CardTitle>Voucher</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="flex items-center gap-1">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  Voucher diterapkan.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}