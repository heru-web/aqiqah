"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { loginAction, type AuthState } from "@/server/actions/auth";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DemoAccount {
  role: string;
  email: string;
  password: string;
  badge?: string;
}

export interface LoginFormProps {
  accounts?: DemoAccount[];
}

export function LoginForm({ accounts = [] }: LoginFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (state?.success) {
      router.replace("/dashboard");
    }
  }, [state, router]);

  function pickAndLogin(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setPickerOpen(false);
    window.setTimeout(() => formRef.current?.requestSubmit(), 100);
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#ffffff] via-[#fcfbf8] to-[#f5f3ef] px-4 py-10">
      {/* Awan abu-awan hijau estetik (cerah) */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0d7c66]/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[64px] h-[64px] bg-[#e8a317]/20 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute top-1/3 right-20 w-72 h-72 bg-[#225349]/10 rounded-full blur-[96px] animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(13,124,102,0.05),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/img/logo-madani.jpg" alt="Madani Aqiqah" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover ring-1 ring-[#0d7c66]/25 drop-shadow-[0_8px_24px_rgba(13,124,102,0.18)]" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Madani Aqiqah</h1>
          <p className="mt-1 font-label-sm text-muted-foreground font-medium">erp · super apps</p>
        </div>

        <div className="rounded-2xl p-6 border border-line bg-card shadow-xl">
          <h2 className="font-headline-md mb-4 text-foreground">Masuk</h2>
          <form ref={formRef} action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-2xl bg-surface/70 px-3.5 py-2 text-foreground ring-1 ring-line transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
                Kata sandi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-2xl bg-surface/70 px-3.5 py-2 text-foreground ring-1 ring-line transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>

            {accounts.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-semibold text-primary hover:text-primary-strong hover:underline"
                >
                  Lihat akun untuk login
                </button>
              </div>
            )}

            {state?.error && (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground ring-1 ring-danger/25">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 w-full items-center justify-center gap-2 relative rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-95 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {pending ? "Memeriksa…" : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
