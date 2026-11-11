"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { transitionOrderAction, registerPaymentAction } from "@/server/actions/sales";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

const NEXT_MAP: Record<string, string[]> = {
  DRAFT: ["ORDER_CONFIRMED"],
  ORDER_CONFIRMED: ["ANIMALS_SIAAP"],
  ANIMALS_SIAAP: ["SLAUGHTERED"],
  SLAUGHTERED: ["KARKAS_FILLET"],
  KARKAS_FILLET: ["KITCHEN_COOKED"],
  KITCHEN_COOKED: ["PACKED"],
  PACKED: ["QC_READY"],
  QC_READY: ["READY_DISPATCH"],
  READY_DISPATCH: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const TERMINAL = new Set(["COMPLETED", "CANCELLED"]);

export function OrderTransitions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [askCancel, setAskCancel] = useState(false);
  const nexts = NEXT_MAP[status] ?? [];

  const run = (toStatus: string, reason?: string) =>
    start(async () => {
      const res = await transitionOrderAction(orderId, toStatus, reason);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Status → ${ORDER_STATUS_LABELS[toStatus]}`);
        router.refresh();
      }
    });

  if (TERMINAL.has(status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nexts.map((n) => (
        <Button key={n} onClick={() => run(n)} disabled={pending}>
          <CheckIcon className="h-4 w-4" /> {ORDER_STATUS_LABELS[n]}
        </Button>
      ))}
      <Button
        variant="outline"
        onClick={() => setAskCancel(true)}
        disabled={pending}
      >
        <XIcon className="h-4 w-4" /> Batalkan
      </Button>
      <ConfirmDialog
        open={askCancel}
        onOpenChange={setAskCancel}
        title="Batalkan order ini?"
        description="Status order akan berubah menjadi BATAL dan tidak bisa dilanjutkan."
        confirmLabel="Ya, batalkan"
        tone="danger"
        pending={pending}
        onConfirm={() => {
          setAskCancel(false);
          run("CANCELLED");
        }}
      />
    </div>
  );
}

export function RegisterPaymentButton({
  invoiceId,
  orderId,
  amount,
  disabled,
}: {
  invoiceId: string | null;
  orderId: string;
  amount: bigint;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState("TRANSFER");
  const [amt, setAmt] = useState(amount <= 0n ? "" : amount.toString());
  const [open, setOpen] = useState(false);

  const submit = () =>
    start(async () => {
      if (!amt || Number(amt) <= 0) {
        toast.error("Nominal wajib diisi.");
        return;
      }
      const res = await registerPaymentAction({
        invoiceId: invoiceId ?? "",
        orderId,
        amount: amt,
        method: method as "TRANSFER" | "CASH" | "QRIS" | "VA" | "CARD",
        notes: "Pembayaran dari halaman order",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Pembayaran tercatat");
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setAmt(amount <= 0n ? "" : amount.toString());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold" disabled={disabled}>
          Catat Pembayaran
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>Pembayaran akan dicatat sebagai invoice payment (belum dikonfirmasi).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="amt">Nominal (Rp)</Label>
            <Input id="amt" type="number" min={1} value={amt} onChange={(e) => setAmt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="method">Metode</Label>
            <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="CASH">Tunai</option>
              <option value="QRIS">QRIS</option>
              <option value="VA">Virtual Account</option>
              <option value="CARD">EDC / Kartu</option>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={submit} disabled={pending} className="bg-gold text-gold-foreground hover:bg-gold-strong">
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}