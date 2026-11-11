"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { createOrderAction, previewOrderPricingAction } from "@/server/actions/sales";
import { formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface CatalogProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: string;
}
export interface CatalogPackage {
  id: string;
  name: string;
  discountBps: number;
}
export interface CatalogCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface WizardLine {
  kind: "PAKET" | "PRODUK";
  entityId: string;
  name: string;
  qty: number;
  unitPrice: string;
}

const STEPS = [
  { id: "customer", label: "Pelanggan" },
  { id: "aqiqah", label: "Detail Aqiqah" },
  { id: "items", label: "Hewan & Paket" },
  { id: "delivery", label: "Pengiriman" },
  { id: "summary", label: "Ringkasan" },
];

export function OrderWizard({
  customers,
  products,
  packages,
  currentUserId,
}: {
  customers: CatalogCustomer[];
  products: CatalogProduct[];
  packages: CatalogPackage[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();

  const [customerId, setCustomerId] = useState("");
  const [aqiqahType, setAqiqahType] = useState("AKIKAH");
  const [shohibulName, setShohibulName] = useState("");
  const [shohibulGender, setShohibulGender] = useState<"L" | "P" | "">("");
  const [childName, setChildName] = useState("");
  const [bornDate, setBornDate] = useState("");
  const [aqiqahDay, setAqiqahDay] = useState("7");
  const [aqiqahDate, setAqiqahDate] = useState("");

  const [lines, setLines] = useState<WizardLine[]>([]);
  const [productId, setProductId] = useState("");
  const [packageId, setPackageId] = useState("");

  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [voucherCode, setVoucherCode] = useState("");
  const [confirmImmediately, setConfirmImmediately] = useState(false);
  const [notes, setNotes] = useState("");

  const draftTouched = useRef(false);
  const draftStorageKey = `madani.order-draft.${currentUserId}`;
  const draftJson = JSON.stringify({ customerId, aqiqahType, shohibulName, childName, bornDate, aqiqahDay, aqiqahDate, deliveryDate, deliveryTimeSlot, recipientName, recipientPhone, deliveryAddress, deliveryCity, deliveryDistrict, deliveryLandmark, deliveryNote, shippingAmount, voucherCode, notes, lines, step, confirmImmediately, shohibulGender });
  useEffect(() => {
    if (!draftTouched.current) return;
    try { sessionStorage.setItem(draftStorageKey, draftJson); } catch { /* Storage may be disabled. */ }
  }, [draftStorageKey, draftJson]);
  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem(draftStorageKey);
      if (!raw) { toast.info("Belum ada draft pada tab ini."); return; }
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object") throw new Error();
      if (typeof draft.customerId === "string") setCustomerId(draft.customerId);
      if (typeof draft.aqiqahType === "string") setAqiqahType(draft.aqiqahType);
      if (typeof draft.shohibulName === "string") setShohibulName(draft.shohibulName);
      if (typeof draft.childName === "string") setChildName(draft.childName);
      if (typeof draft.bornDate === "string") setBornDate(draft.bornDate);
      if (typeof draft.aqiqahDay === "string") setAqiqahDay(draft.aqiqahDay);
      if (typeof draft.aqiqahDate === "string") setAqiqahDate(draft.aqiqahDate);
      if (typeof draft.deliveryDate === "string") setDeliveryDate(draft.deliveryDate);
      if (typeof draft.deliveryTimeSlot === "string") setDeliveryTimeSlot(draft.deliveryTimeSlot);
      if (typeof draft.recipientName === "string") setRecipientName(draft.recipientName);
      if (typeof draft.recipientPhone === "string") setRecipientPhone(draft.recipientPhone);
      if (typeof draft.deliveryAddress === "string") setDeliveryAddress(draft.deliveryAddress);
      if (typeof draft.deliveryCity === "string") setDeliveryCity(draft.deliveryCity);
      if (typeof draft.deliveryDistrict === "string") setDeliveryDistrict(draft.deliveryDistrict);
      if (typeof draft.deliveryLandmark === "string") setDeliveryLandmark(draft.deliveryLandmark);
      if (typeof draft.deliveryNote === "string") setDeliveryNote(draft.deliveryNote);
      if (typeof draft.shippingAmount === "string") setShippingAmount(draft.shippingAmount);
      if (typeof draft.voucherCode === "string") setVoucherCode(draft.voucherCode);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (Array.isArray(draft.lines) && draft.lines.length <= 50 && draft.lines.every((line: WizardLine) =>
        line && ["PRODUK", "PAKET"].includes(line.kind) && typeof line.entityId === "string" && typeof line.name === "string" && /^\d+$/.test(line.unitPrice) && Number.isInteger(line.qty) && line.qty > 0 && line.qty <= 1000)) setLines(draft.lines);
      if (typeof draft.step === "number" && draft.step >= 0 && draft.step <= 4) setStep(draft.step);
      if (["L", "P", ""].includes(draft.shohibulGender)) setShohibulGender(draft.shohibulGender);
      if (typeof draft.confirmImmediately === "boolean") setConfirmImmediately(draft.confirmImmediately);
      draftTouched.current = true;
      toast.success("Draft dipulihkan. Periksa data dan harga sebelum melanjutkan.");
    } catch { toast.error("Draft tidak dapat dipulihkan."); }
  }

  const [quote, setQuote] = useState<{ key: string; itemsTotal: string; discount: string; shipping: string; total: string } | null>(null);
  const [priceError, setPriceError] = useState("");
  const priceKey = JSON.stringify({ lines, shippingAmount, voucherCode });
  const quoteReady = quote?.key === priceKey;
  useEffect(() => {
    if (step !== 4 || lines.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await previewOrderPricingAction({ items: lines.map((l) => ({ kind: l.kind, entityId: l.entityId, description: l.name, quantity: l.qty, unitPrice: l.unitPrice, discountBps: 0, isFree: false })), shippingAmount: shippingAmount || "0", voucherCode: voucherCode.trim() || undefined });
        if (cancelled) return;
        if (result.error || result.total === undefined) { setQuote(null); setPriceError(result.error ?? "Harga belum tersedia."); return; }
        setQuote({ key: priceKey, itemsTotal: result.itemsTotal!, discount: result.discount!, shipping: result.shipping!, total: result.total });
        setPriceError("");
      } catch { if (!cancelled) { setQuote(null); setPriceError("Gagal menghitung harga. Coba lagi."); } }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [step, priceKey, lines, shippingAmount, voucherCode]);

  const canNext = (): boolean => {
    if (step === 0) return customerId.length > 0;
    if (step === 2) return lines.length > 0;
    return true;
  };

  const addProduct = () => {
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const existing = lines.find((l) => l.entityId === p.id && l.kind === "PRODUK");
    if (existing) {
      setLines((ls) => ls.map((l) => (existing === l ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines((ls) => [...ls, { kind: "PRODUK", entityId: p.id, name: p.name, qty: 1, unitPrice: p.salePrice }]);
    }
  };

  const addPackage = () => {
    if (!packageId) return;
    const p = packages.find((x) => x.id === packageId);
    if (!p) return;
    const existing = lines.find((l) => l.entityId === p.id && l.kind === "PAKET");
    if (existing) {
      setLines((ls) => ls.map((l) => (existing === l ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines((ls) => [...ls, { kind: "PAKET", entityId: p.id, name: p.name, qty: 1, unitPrice: "0" }]);
    }
  };

  const submitOrder = () => {
    if (!quoteReady || !quote) return;
    start(async () => {
      const res = await createOrderAction({
        customerId,
        aqiqahType: aqiqahType as "AKIKAH" | "TASMIYAH" | "DONASI",
        shohibulName: shohibulName || undefined,
        shohibulGender: shohibulGender || undefined,
        childName: childName || undefined,
        bornDate: bornDate ? new Date(bornDate).toISOString() : undefined,
        aqiqahDay: aqiqahDay ? Number(aqiqahDay) : undefined,
        aqiqahDate: aqiqahDate ? new Date(aqiqahDate).toISOString() : undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        deliveryTimeSlot: deliveryTimeSlot || undefined,
        recipientName: recipientName || undefined,
        recipientPhone: recipientPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryCity: deliveryCity || undefined,
        deliveryDistrict: deliveryDistrict || undefined,
        deliveryLandmark: deliveryLandmark || undefined,
        deliveryNote: deliveryNote || undefined,
        shippingAmount: shippingAmount || "0",
        voucherCode: voucherCode.trim() || undefined,
        items: lines.map((l) => ({
          kind: l.kind,
          entityId: l.entityId,
          description: l.name,
          quantity: l.qty,
          unitPrice: l.unitPrice,
          discountBps: 0,
          isFree: false,
        })),
        channel: "WEB",
        notes: notes || undefined,
        confirmImmediately,
        expectedTotal: quote.total,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      draftTouched.current = false;
      try { sessionStorage.removeItem(draftStorageKey); } catch {}
      toast.success("Pesanan dibuat");
      if (res.id) router.push(`/orders/${res.id}`);
    });
  };

  return (
    <div onChangeCapture={() => { draftTouched.current = true; }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Draft disimpan otomatis selama tab ini terbuka.</p><Button type="button" variant="outline" size="sm" onClick={restoreDraft}>Pulihkan draft</Button></div>
      <ol className="mb-6 flex flex-wrap items-center gap-1 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "text-primary hover:bg-muted"
                    : "text-muted-foreground"
              }`}
            >
              {i < step ? <CheckIcon className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
              <span className={i > 2 ? "hidden sm:inline" : ""}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step].label}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="orderCustomer">Pelanggan *</Label>
                <Select id="orderCustomer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Pilih pelanggan…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `· ${c.phone}` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Belum ada pelanggan? Tambah dulu di menu Pelanggan.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shohibulName">Nama Shohibul</Label>
                <Input id="shohibulName" value={shohibulName} onChange={(e) => setShohibulName(e.target.value)} placeholder="Sesuai identitas pelanggan" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aqiqahType">Jenis Aqiqah</Label>
                <Select id="aqiqahType" value={aqiqahType} onChange={(e) => setAqiqahType(e.target.value)}>
                  <option value="AKIKAH">Aqiqah / Akikah</option>
                  <option value="TASMIYAH">Tasmiyah</option>
                  <option value="DONASI">Donasi</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="childName">Nama Anak</Label>
                <Input id="childName" value={childName} onChange={(e) => setChildName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shohibulGender">Gender</Label>
                  <Select id="shohibulGender" value={shohibulGender} onChange={(e) => setShohibulGender(e.target.value as "L" | "P")}>
                    <option value="">—</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aqiqahDay">Hari ke-</Label>
                  <Select id="aqiqahDay" value={aqiqahDay} onChange={(e) => setAqiqahDay(e.target.value)}>
                    <option value="7">7</option>
                    <option value="14">14</option>
                    <option value="21">21</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bornDate">Tanggal Lahir / Aqiqah</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input id="bornDate" type="date" value={bornDate} onChange={(e) => setBornDate(e.target.value)} />
                  <Input type="date" value={aqiqahDate} onChange={(e) => setAqiqahDate(e.target.value)} title="Tanggal pelaksanaan aqiqah" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Hewan / Produk</Label>
                    <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                      <option value="">Pilih item…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatIDR(p.salePrice)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="secondary" size="icon" onClick={addProduct} aria-label="Tambah item">
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="orderPackage">Paket Aqiqah</Label>
                    <Select id="orderPackage" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                      <option value="">Pilih paket…</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="gold" size="icon" onClick={addPackage} aria-label="Tambah paket">
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Belum ada item. Tambah hewan, produk olahan, atau paket.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {lines.map((l) => (
                    <li key={`${l.kind}-${l.entityId}`} className="flex items-center gap-3 px-3 py-2.5">
                      <Badge variant={l.kind === "PAKET" ? "gold" : "neutral"}>{l.kind === "PAKET" ? "Paket" : "Item"}</Badge>
                      <span className="flex-1 text-sm text-foreground">{l.name}</span>
                      <Input
                        type="number"
                        aria-label={`Jumlah ${l.name}`}
                        step={1}
                        max={1000}
                        min={1}
                        className="h-8 w-20 text-center"
                        value={l.qty}
                        onChange={(e) =>
                          setLines((ls) => ls.map((x) => (x === l ? { ...x, qty: Math.min(1000, Math.max(1, Math.trunc(Number(e.target.value)) || 1)) } : x)))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLines((ls) => ls.filter((x) => x !== l))}
                        aria-label="Hapus item"
                      >
                        <TrashIcon className="h-4 w-4 text-danger" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deliveryDate">Tanggal Pengiriman</Label>
                <Input id="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryTimeSlot">Waktu (Sesi)</Label>
                <Select id="deliveryTimeSlot" value={deliveryTimeSlot} onChange={(e) => setDeliveryTimeSlot(e.target.value)}>
                  <option value="">Pilih sesi…</option>
                  <option value="PAGI">Pagi (09.00–12.00)</option>
                  <option value="SIANG">Siang (12.00–15.00)</option>
                  <option value="SORE">Sore (15.00–18.00)</option>
                  <option value="MALAM">Malam (19.00–21.00)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientName">Nama Penerima</Label>
                <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientPhone">Telepon Penerima</Label>
                <Input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="0812-..." />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="deliveryAddress">Alamat Pengiriman</Label>
                <Textarea id="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryCity">Kota</Label>
                <Input id="deliveryCity" value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryDistrict">Kecamatan</Label>
                <Input id="deliveryDistrict" value={deliveryDistrict} onChange={(e) => setDeliveryDistrict(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryLandmark">Titik / Landmark</Label>
                <Input id="deliveryLandmark" value={deliveryLandmark} onChange={(e) => setDeliveryLandmark(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deliveryNote">Catatan Kurir</Label>
                <Input id="deliveryNote" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {lines.map((l) => (
                  <li key={`${l.kind}-${l.entityId}`} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <span className="text-foreground">{(l.qty > 1 ? `${l.qty} × ` : "") + l.name}</span>
                    {l.kind === "PRODUK" && <span className="font-data text-muted-foreground">{formatIDR(l.unitPrice)}</span>}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shippingAmount">Ongkir (Rp)</Label>
                  <Input id="shippingAmount" type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Catatan Order</Label>
                  <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary"
                      checked={confirmImmediately}
                      onChange={(e) => setConfirmImmediately(e.target.checked)}
                    />
                    Catat rencana pembayaran transfer (menunggu konfirmasi)
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="voucherCode">Kode voucher / promo (opsional)</Label>
                <Input
                  id="voucherCode"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="mis. AQIQAH10 - validasi otomatis saat submit (aktif, kuota, periode)"
                  className="uppercase"
                />
              </div>
              <div className="rounded-lg bg-surface-dim p-4" aria-live="polite" aria-busy={!quoteReady && !priceError}>
                {priceError ? <p role="alert" className="text-sm text-danger">{priceError}</p> : !quoteReady ? <p className="text-sm">Menghitung harga…</p> : <>
                  <div className="flex justify-between text-sm"><span>Subtotal produk dan paket</span><span>{formatIDR(quote!.itemsTotal)}</span></div>
                  <div className="flex justify-between text-sm"><span>Diskon dan voucher</span><span>− {formatIDR(quote!.discount)}</span></div>
                  <div className="flex justify-between text-sm"><span>Ongkir</span><span>{formatIDR(quote!.shipping)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold"><span>Total pesanan</span><span>{formatIDR(quote!.total)}</span></div>
                </>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          <ArrowLeftIcon className="h-4 w-4" /> Kembali
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => canNext() && setStep((s) => s + 1)} disabled={!canNext()}>
            Lanjut <ArrowRightIcon className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submitOrder} disabled={pending || !quoteReady || lines.length === 0 || !customerId} className="bg-gold text-gold-foreground hover:bg-gold-strong">
            {pending ? "Membuat…" : "Buat Pesanan"}
          </Button>
        )}
      </div>
    </div>
  );
}