"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import type { MasterFormState } from "@/components/performance/master-crud-dialog";

type FormAction = (prev: MasterFormState, fd: FormData) => Promise<MasterFormState>;

interface Props {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  confirmMessage?: string;
  successMessage?: string;
}

export function FormActionButton({
  action,
  fields,
  label,
  icon,
  variant = "secondary",
  size = "sm",
  confirmMessage,
  successMessage,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);

  const run = () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    start(async () => {
      const res = await action(undefined, fd);
      if (res?.error) toast.error(res.error);
      else {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      }
    });
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={pending}
      onClick={confirmMessage ? () => setAsk(true) : run}
    >
      {icon}
      {label}
    </Button>
  );

  if (!confirmMessage) return button;

  return (
    <>
      {button}
      <ConfirmDialog
        open={ask}
        onOpenChange={setAsk}
        title={label}
        description={confirmMessage}
        tone="info"
        pending={pending}
        onConfirm={() => {
          setAsk(false);
          run();
        }}
      />
    </>
  );
}
