"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toggleUserActiveAction } from "@/server/actions/system";
import { toast } from "sonner";

export function UserActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);

  const submit = (v: boolean) =>
    start(async () => {
      const res = await toggleUserActiveAction(id, v);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });

  return (
    <>
      <Switch
        checked={isActive}
        disabled={pending}
        onCheckedChange={() => setAsk(true)}
        aria-label={isActive ? "Nonaktifkan pengguna" : "Aktifkan pengguna"}
      />
      <ConfirmDialog
        open={ask}
        onOpenChange={setAsk}
        title={isActive ? "Nonaktifkan pengguna ini?" : "Aktifkan pengguna ini?"}
        description={
          isActive
            ? "Pengguna tidak akan bisa masuk ke aplikasi sampai diaktifkan kembali."
            : "Pengguna akan bisa masuk kembali ke aplikasi."
        }
        confirmLabel={isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        tone={isActive ? "danger" : "info"}
        pending={pending}
        onConfirm={() => {
          setAsk(false);
          submit(!isActive);
        }}
      />
    </>
  );
}
