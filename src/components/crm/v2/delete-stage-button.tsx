"use client";

import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { deleteStageAction } from "@/server/actions/crm";

export function DeleteStageButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();

  return (
    <ConfirmButton
      tone="danger"
      title={`Hapus tahap "${name}"?`}
      description="Tahap yang masih dipakai deal tidak bisa dihapus — pindahkan dulu deal-nya ke tahap lain."
      confirmLabel="Ya, hapus tahap"
      onConfirm={async () => {
        const result = await deleteStageAction(id);
        if (result.error) return result.error;
        toast.success("Tahap dihapus.");
        router.refresh();
      }}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="compact"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-danger"
          title="Hapus tahap"
        >
          <Trash2Icon className="h-4 w-4" />
        </Button>
      }
    />
  );
}
