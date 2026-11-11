"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runKpiSyncAction } from "@/server/actions/performance";

/** Tombol "Sinkronkan KPI sekarang" — menjalankan formula ERP → aktual AUTO. */
export function SyncKpiButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await runKpiSyncAction();
          if (res.error) {
            toast.error(res.error);
            return;
          }
          toast.success(
            `Sinkronisasi selesai: ${res.computed ?? 0} baru, ${res.updated ?? 0} diperbarui${
              (res.nulls ?? 0) > 0 ? `, ${res.nulls} menunggu data` : ""
            }`
          );
          router.refresh();
        });
      }}
    >
      <RefreshCwIcon className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Menyinkronkan…" : "Sinkronkan KPI"}
    </Button>
  );
}
