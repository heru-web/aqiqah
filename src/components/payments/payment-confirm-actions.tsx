"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { confirmPaymentAction } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { toast } from "sonner";

export function PaymentConfirmActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  if (status !== "PENDING") return null;

  const act = async (to: "CONFIRMED" | "FAILED") => {
    const res = await confirmPaymentAction(id, to);
    if (!res.error) {
      toast.success(to === "CONFIRMED" ? "Pembayaran dikonfirmasi" : "Pembayaran ditandai gagal");
      router.refresh();
    }
    return res;
  };

  return (
    <div className="flex justify-end gap-1.5">
      <ConfirmButton
        trigger={
          <Button size="sm" variant="ghost" aria-label="Konfirmasi pembayaran">
            <CheckIcon className="h-4 w-4" />
          </Button>
        }
        title="Konfirmasi pembayaran ini?"
        description="Uang masuk akan dicatat ke buku kas dan status tagihan diperbarui."
        confirmLabel="Ya, konfirmasi"
        tone="info"
        onConfirm={() => act("CONFIRMED")}
      />
      <ConfirmButton
        trigger={
          <Button size="sm" variant="ghost" aria-label="Tandai pembayaran gagal">
            <XIcon className="h-4 w-4 text-danger" />
          </Button>
        }
        title="Tandai pembayaran gagal?"
        description="Status pembayaran akan berubah menjadi GAGAL. Pastikan bukti transfer tidak valid."
        confirmLabel="Ya, tandai gagal"
        tone="danger"
        onConfirm={() => act("FAILED")}
      />
    </div>
  );
}
