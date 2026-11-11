"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, SendIcon, XIcon } from "lucide-react";
import { quotationAcceptedAction, quotationSendAction, quotationVoidAction } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { toast } from "sonner";

export function QuotationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  const run = async (fn: () => Promise<{ error?: string }>, okMsg: string) => {
    const res = await fn();
    if (!res.error) {
      toast.success(okMsg);
      router.refresh();
    }
    return res;
  };

  if (!["DRAFT", "SENT"].includes(status)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <ConfirmButton
          trigger={
            <Button size="sm">
              <SendIcon className="h-4 w-4" /> Kirim Penawaran
            </Button>
          }
          title="Kirim penawaran ini?"
          description="Penawaran akan dikirim ke shohibul dan tidak bisa diedit lagi."
          confirmLabel="Ya, kirim"
          tone="info"
          onConfirm={() => run(() => quotationSendAction(id), "Penawaran dikirim")}
        />
      )}
      {status === "SENT" && (
        <ConfirmButton
          trigger={
            <Button size="sm" variant="gold">
              <CheckIcon className="h-4 w-4" /> Disetujui
            </Button>
          }
          title="Setujui penawaran ini?"
          description="Order akan dibuat otomatis dari penawaran ini dan penawaran tidak bisa diubah lagi."
          confirmLabel="Ya, setujui"
          tone="info"
          onConfirm={() => run(() => quotationAcceptedAction(id), "Disetujui → dibuatkan order")}
        />
      )}
      <ConfirmButton
        trigger={
          <Button size="sm" variant="outline">
            <XIcon className="h-4 w-4" /> Batal
          </Button>
        }
        title="Batalkan penawaran?"
        description="Status penawaran akan menjadi BATAL dan tidak bisa dipakai lagi."
        confirmLabel="Ya, batalkan"
        tone="danger"
        onConfirm={() => run(() => quotationVoidAction(id), "Penawaran dibatalkan")}
      />
    </div>
  );
}
