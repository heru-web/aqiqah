"use client";

import { useRef, useState, useTransition, type FormHTMLAttributes, type ReactNode } from "react";

type Result = { error?: string } | void;

/** Keep inputs on failure and expose a visible result for simple server-action forms. */
export function ActionForm({ action, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (data: FormData) => Promise<Result>; children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const submitting = useRef(false);
  return <form {...props} aria-busy={pending} onSubmit={(event) => {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setMessage(null);
    start(async () => {
      try {
        const result = await action(data);
        setMessage(result?.error ? { error: true, text: result.error } : { error: false, text: "Perubahan tersimpan." });
      } catch {
        setMessage({ error: true, text: "Perubahan gagal disimpan. Periksa data dan hak akses, lalu coba lagi." });
      } finally { submitting.current = false; }
    });
  }}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending && <span role="status" className="text-xs text-muted-foreground">Menyimpan…</span>}
    {message && <span role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-danger" : "text-sm text-primary"}>{message.text}</span>}
  </form>;
}
