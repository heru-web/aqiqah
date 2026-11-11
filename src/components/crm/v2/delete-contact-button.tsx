"use client";

import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { deleteOrganizationAction, deletePersonAction } from "@/server/actions/crm";

export function DeleteContactButton({
  id,
  kind,
  label = "Hapus",
}: {
  id: string;
  kind: "person" | "organization";
  label?: string;
}) {
  const router = useRouter();
  const isPerson = kind === "person";

  return (
    <ConfirmButton
      tone="danger"
      title={isPerson ? "Hapus kontak ini?" : "Hapus perusahaan ini?"}
      description={
        isPerson
          ? "Kontak akan diarsipkan dari daftar. Deal yang terkait tetap tersimpan di pipeline, aktivitas terkait ikut diarsipkan."
          : "Perusahaan akan diarsipkan dari daftar. Kontak dan deal terkait tetap tersimpan, hanya kehilangan relasi perusahaan."
      }
      confirmLabel="Ya, hapus"
      onConfirm={async () => {
        const result = isPerson ? await deletePersonAction(id) : await deleteOrganizationAction(id);
        if (result.error) return result.error;
        toast.success(isPerson ? "Kontak dihapus." : "Perusahaan dihapus.");
        router.push("/crm/contacts");
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
