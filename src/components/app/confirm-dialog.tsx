"use client";

import * as React from "react";
import { useState } from "react";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

/** Hasil aksi konfirmasi: string = pesan error (dialog tetap terbuka). */
export type ConfirmOutcome = { error?: string } | string | undefined | void;

interface ConfirmBodyProps {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "info";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel?: () => void;
}

const TONE_META = {
  danger: {
    icon: AlertTriangleIcon,
    wrap: "bg-danger-soft text-danger-soft-foreground",
    button: "destructive" as const,
  },
  info: {
    icon: InfoIcon,
    wrap: "bg-primary/10 text-primary",
    button: "default" as const,
  },
};

function ConfirmBody({
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "info",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmBodyProps) {
  const meta = TONE_META[tone];
  const Icon = meta.icon;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", meta.wrap)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 break-words">{title}</span>
        </DialogTitle>
        <DialogDescription className="pl-[42px]">{description}</DialogDescription>
      </DialogHeader>
      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground">{error}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={meta.button} onClick={onConfirm} disabled={pending}>
          {pending ? "Memproses…" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "info";
  pending?: boolean;
  onConfirm: () => void;
}

/** Dialog konfirmasi terkontrol (dipakai programatik, mis. sebelum pindah tahap). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "info",
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <ConfirmBody
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          tone={tone}
          pending={pending}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmButtonProps {
  /** Elemen pemicu, biasanya <Button/> atau tombol ikon. */
  trigger: React.ReactElement;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "info";
  /** Balikkan string/pesan error agar dialog tetap terbuka dan menampilkan pesan. */
  onConfirm: () => Promise<ConfirmOutcome> | ConfirmOutcome;
}

/** Tombol pemicu + dialog konfirmasi bawaan; menangani pending & error sendiri. */
export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "info",
  onConfirm,
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const outcome = await onConfirm();
      const messageText =
        typeof outcome === "string"
          ? outcome
          : outcome && typeof outcome === "object" && "error" in outcome
            ? outcome.error
            : undefined;
      if (messageText) {
        setError(messageText);
        return;
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <ConfirmBody
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          tone={tone}
          pending={pending}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
