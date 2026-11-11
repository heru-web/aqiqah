"use client";
import { ActionForm } from "@/components/app/action-form";

import { useState } from "react";
import { PencilIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ActionResult { error?: string }

export function DeleteRowsButton({ ids, action, confirmText }: {
  ids: string[];
  action: (ids: string[]) => Promise<ActionResult>;
  confirmText?: string;
}) {
  return (
    <ConfirmButton
      tone="danger"
      title={`Hapus ${ids.length} data terpilih?`}
      description={confirmText ?? "Aksi tetap tercatat di Log Audit."}
      confirmLabel="Ya, hapus"
      trigger={
        <Button size="compact" variant="destructive" disabled={ids.length === 0}>
          <TrashIcon className="h-3.5 w-3.5" />
          Hapus {ids.length}
        </Button>
      }
      onConfirm={() => action(ids)}
    />
  );
}

export function DeleteRowButton({ id, action, title, variant = "ghost" }: {
  id: string;
  action: (ids: string[]) => Promise<ActionResult>;
  title?: string;
  variant?: "ghost" | "outline" | "destructive";
}) {
  const label = title ?? "Hapus baris ini?";
  return (
    <ConfirmButton
      tone="danger"
      title={label}
      description="Aksi tetap tercatat di Log Audit."
      confirmLabel="Ya, hapus"
      trigger={
        <Button size="compact" variant={variant} className={cn(variant === "ghost" && "text-muted-foreground")}>
          <TrashIcon className="h-3.5 w-3.5" />
          Hapus
        </Button>
      }
      onConfirm={() => action([id])}
    />
  );
}

export function RowEditDialog({ title, description, action, fields, submitLabel = "Simpan" }: {
  title: string;
  description?: string;
  action: (fd: FormData) => Promise<{ error?: string } | void>;
  fields: React.ReactNode;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="compact" variant="ghost" type="button">
          <PencilIcon className="h-3.5 w-3.5" />
          Ubah
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ActionForm
          action={async (fd) => {
            const result = await action(fd);
            if (!result?.error) setOpen(false);
            return result;
          }}
          className="space-y-4"
        >
          {fields}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" >{submitLabel}</Button>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
