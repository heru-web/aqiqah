"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

type ActionResult = { error?: string; success?: boolean } | undefined;

interface Props<A extends string[]> {
  /** Server action (diekspor dari file "use server"). */
  action: (...args: A) => Promise<ActionResult>;
  /** Argumen posisi untuk action (biasanya [id]). */
  params: A;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  confirmMessage?: string;
  successMessage?: string;
  disabled?: boolean;
}

export function ActionButton<A extends string[]>({
  action,
  params,
  label,
  icon,
  variant = "outline",
  size = "sm",
  confirmMessage,
  successMessage,
  disabled,
}: Props<A>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);

  const run = () =>
    start(async () => {
      const res = await action(...params);
      if (res?.error) toast.error(res.error);
      else {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      }
    });

  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={pending || disabled}
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
