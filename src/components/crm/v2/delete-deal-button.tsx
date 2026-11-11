"use client";

import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { deleteDealAction } from "@/server/actions/crm";

export function DeleteDealButton({ dealId, label = "Hapus" }: { dealId: string; label?: string }) {
  const router = useRouter();

  return (
    <ConfirmButton
      tone="danger"
      title="Hapus deal ini?"
      description="Deal beserta seluruh aktivitas terkait akan diarsipkan dari pipeline. Tindakan ini tidak dapat dibatalkan dari daftar."
      confirmLabel="Ya, hapus deal"
      onConfirm={async () => {
        const result = await deleteDealAction(dealId);
        if (result.error) return result.error;
        toast.success("Deal dihapus.");
        router.push("/crm");
        router.refresh();
      }}
      trigger={
        <Button type="button" variant="ghost" size="compact" className="text-danger-soft-foreground">
          <Trash2Icon className="h-4 w-4" /> {label}
        </Button>
      }
    />
  );
}
