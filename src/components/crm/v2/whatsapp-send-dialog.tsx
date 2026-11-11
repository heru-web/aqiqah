"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsappTemplate } from "@/lib/whatsapp";
import { sendWhatsappAction, type WhatsappFormState } from "@/server/actions/whatsapp";
import { toast } from "sonner";

export function WhatsappSendDialog({
  defaultTo,
  personName,
  dealId,
  personId,
  templates,
  trigger,
}: {
  defaultTo?: string | null;
  personName?: string | null;
  dealId?: string;
  personId?: string;
  templates: WhatsappTemplate[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [message, setMessage] = useState(templates[0]?.body ?? "");

  const [state, action, pending] = useActionState<WhatsappFormState, FormData>(
    async (previous, formData) => {
      const result = await sendWhatsappAction(previous, formData);
      if (result?.success) {
        toast.success(result.message ?? "WhatsApp terkirim.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    undefined
  );

  const pickTemplate = (key: string) => {
    setTemplateKey(key);
    const template = templates.find((item) => item.key === key);
    if (template) setMessage(template.body);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleIcon className="h-4 w-4 text-primary" />
            Kirim WhatsApp
          </DialogTitle>
          <DialogDescription>
            {personName ? `Pesan untuk ${personName}. ` : ""}
            Dikirim melalui WhatsApp Gateway yang terhubung.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          {personId && <input type="hidden" name="personId" value={personId} />}

          <div className="space-y-1.5">
            <Label htmlFor="wa-send-to">Nomor WhatsApp *</Label>
            <Input
              id="wa-send-to"
              name="to"
              required
              defaultValue={defaultTo ?? ""}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="off"
            />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="wa-send-template">Template</Label>
              <Select
                id="wa-send-template"
                value={templateKey}
                onChange={(event) => pickTemplate(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="wa-send-message">Pesan *</Label>
              <span className="text-[10.5px] text-muted-foreground">{message.length} karakter</span>
            </div>
            <Textarea
              id="wa-send-message"
              name="message"
              required
              rows={8}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tulis pesan WhatsApp…"
            />
            <p className="text-[10.5px] text-muted-foreground">
              Tanda tangan dari pengaturan akan ditambahkan otomatis di akhir pesan.
            </p>
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <SendIcon className="h-4 w-4" />
              {pending ? "Mengirim…" : "Kirim WhatsApp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
