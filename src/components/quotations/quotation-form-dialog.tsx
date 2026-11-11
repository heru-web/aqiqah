"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "lucide-react";
import { createQuotationAction } from "@/server/actions/sales";
import { formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface QuoteCustomer {
  id: string;
  name: string;
  phone: string | null;
}
export interface QuoteProduct {
  id: string;
  name: string;
  unit: string;
  salePrice: string;
}
export interface QuotePackage {
  id: string;
  name: string;
  slug: string;
  discountBps: number;
}

interface Line {
  kind: "PAKET" | "PRODUK";
  entityId: string;
  name: string;
  qty: number;
  unitPrice: string;
}

export function CreateQuotationDialog({
  customers,
  products,
  packages,
}: {
  customers: QuoteCustomer[];
  products: QuoteProduct[];
  packages: QuotePackage[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [voucherCode, setVoucherCode] = useState("");

  const add = (kind: Line["kind"], id: string) => {
    if (!id) return;
    const src = kind === "PRODUK" ? products.find((x) => x.id === id) : packages.find((x) => x.id === id);
    if (!src) return;
    const existing = lines.find((l) => l.entityId === id && l.kind === kind);
    if (existing) {
      setLines((ls) => ls.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setLines((ls) => [
        ...ls,
        { kind, entityId: id, name: src.name, qty: 1, unitPrice: kind === "PRODUK" ? (src as QuoteProduct).salePrice : "0" },
      ]);
    }
  };

  const submit = () =>
    start(async () => {
      if (lines.length === 0) {
        toast.error("Minimal satu item.");
        return;
      }
      const res = await createQuotationAction({
        customerId,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        items: lines.map((l) => ({
          kind: l.kind,
          entityId: l.entityId,
          description: l.name,
          quantity: l.qty,
          unitPrice: l.unitPrice,
          discountBps: 0,
          isFree: false,
        })),
        notes: notes || undefined,
        voucherCode: voucherCode.trim() || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Penawaran dibuat");
        setOpen(false);
        setLines([]);
        router.refresh();
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="h-4 w-4" /> Penawaran Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Penawaran</DialogTitle>
          <DialogDescription>Daftar harga dibekukan saat penawaran dibuat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pelanggan *</Label>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Pilih…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `· ${c.phone}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validUntil">Berlaku sampai</Label>
              <Input id="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Produk</Label>
                <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Pilih…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatIDR(p.salePrice)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="secondary" size="icon" type="button" onClick={() => add("PRODUK", productId)} aria-label="Tambah produk">
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Paket</Label>
                <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">Pilih…</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="gold" size="icon" type="button" onClick={() => add("PAKET", packageId)} aria-label="Tambah paket">
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              Belum ada item.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {lines.map((l) => (
                <li key={`${l.kind}-${l.entityId}`} className="flex items-center gap-3 px-3 py-2">
                  <Badge variant={l.kind === "PAKET" ? "gold" : "neutral"}>{l.kind === "PAKET" ? "Paket" : "Item"}</Badge>
                  <span className="flex-1 text-sm text-foreground">{l.name}</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-20 text-center"
                    value={l.qty}
                    onChange={(e) =>
                      setLines((ls) => ls.map((x) => (x === l ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))
                    }
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={() => setLines((ls) => ls.filter((x) => x !== l))} aria-label="Hapus">
                    <TrashIcon className="h-4 w-4 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vCode">Kode voucher (opsional)</Label>
              <Input id="vCode" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="AQIQAH10" className="uppercase" />
              <p className="text-[11px] text-muted-foreground">Potongan preview di penawaran; pemakaian kuota tercatat saat order.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan / Syarat</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>Batal</Button>
          <Button type="button" onClick={submit} disabled={pending || !customerId || lines.length === 0}>
            {pending ? "Menyimpan…" : "Simpan Penawaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}