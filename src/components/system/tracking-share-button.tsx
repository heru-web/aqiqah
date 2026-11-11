"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkIcon, Loader2Icon } from "lucide-react";
import { getDeliveryTrackingLinkAction } from "@/server/actions/erp";

export function TrackingShareButton({ taskId }: { taskId: string }) {
  const [pending, setPending] = useState(false);

  async function share() {
    setPending(true);
    const res = await getDeliveryTrackingLinkAction(taskId);
    setPending(false);
    if (res.error || !res.path) {
      toast.error(res.error ?? "Gagal membuat link lacak.");
      return;
    }
    const url = `${window.location.origin}${res.path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link lacak disalin", { description: "Kirim ke pelanggan lewat WhatsApp." });
    } catch {
      window.prompt("Salin link lacak ini:", url);
    }
  }

  return (
    <Button
      type="button"
      size="compact"
      variant="outline"
      disabled={pending}
      onClick={() => void share()}
      title="Salin link lacak untuk pelanggan"
    >
      {pending ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
      Lacak
    </Button>
  );
}
