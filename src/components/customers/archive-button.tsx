"use client";

import { useRouter } from "next/navigation";
import { ArchiveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { archiveCustomerAction } from "@/server/actions/customers";

export function ArchiveCustomerButton({ id }: { id: string }) {
  const router = useRouter();

  return (
    <ConfirmButton
      trigger={
        <Button variant="ghost" size="sm" title="Arsipkan">
          <ArchiveIcon className="h-4 w-4" />
        </Button>
      }
      title="Arsipkan pelanggan ini?"
      description="Data tetap tersimpan, tapi tidak tampil lagi di daftar pelanggan aktif."
      confirmLabel="Ya, arsipkan"
      tone="danger"
      onConfirm={async () => {
        const res = await archiveCustomerAction(id);
        if (!res.error) router.refresh();
        return res;
      }}
    />
  );
}
