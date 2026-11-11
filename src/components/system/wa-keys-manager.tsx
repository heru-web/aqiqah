"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRoundIcon, Trash2Icon, ZapIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmButton } from "@/components/app/confirm-dialog";
import { createWaKeyAction, deleteWaKeyAction, activateWaKeyAction } from "@/server/actions/whatsapp";

export interface WaKeyRow {
  id: string;
  provider: "FONNTE" | "CLOUD" | "WAHA";
  label: string;
  tokenMasked: string;
  phoneId: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
}

const PROVIDER_BADGE: Record<string, { label: string; variant: "info" | "gold" | "neutral" }> = {
  FONNTE: { label: "Fonnte", variant: "gold" },
  CLOUD: { label: "Cloud API resmi", variant: "info" },
  WAHA: { label: "WAHA lokal", variant: "neutral" },
};

export function WaKeysManager({ keys }: { keys: WaKeyRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<"add" | "del" | "act" | null>(null);
  const [provider, setProvider] = useState<"FONNTE" | "CLOUD" | "WAHA">("FONNTE");
  const formRef = useRef<HTMLFormElement>(null);

  async function add(fd: FormData) {
    setPending("add");
    const res = await createWaKeyAction(fd);
    setPending(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("API key tersimpan.");
    formRef.current?.reset();
    setProvider("FONNTE");
    router.refresh();
  }

  async function del(id: string) {
    setPending("del");
    const res = await deleteWaKeyAction(id);
    setPending(null);
    if (res?.error) return toast.error(res.error);
    toast.success("API key dihapus.");
    router.refresh();
  }

  async function act(id: string) {
    setPending("act");
    const res = await activateWaKeyAction(id);
    setPending(null);
    if (res?.error) return toast.error(res.error);
    toast.success("API key diaktifkan menjadi pengaturan aktif.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRoundIcon className="h-4 w-4 text-primary" />
          API Key Tersimpan
        </CardTitle>
        <CardDescription>
          Simpan beberapa API key (Fonnte, Cloud API resmi Meta, atau WAHA lokal). Tombol <b>Pakai</b> menjadikan key tersebut pengaturan aktif untuk pengiriman.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form ref={formRef} action={add} className="grid grid-cols-1 gap-2 rounded-xl border border-line-warm p-3 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="wa-key-label">Nama</Label>
            <Input id="wa-key-label" name="label" placeholder="cth. Fonnte Perusahaan" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-key-provider">Provider</Label>
            <Select id="wa-key-provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as "FONNTE")}>
              <option value="FONNTE">Fonnte</option>
              <option value="CLOUD">Cloud API resmi</option>
              <option value="WAHA">WAHA lokal</option>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="wa-key-token">Token / API Key</Label>
            <Input id="wa-key-token" name="token" type="password" required placeholder="Tempel API key" autoComplete="new-password" />
          </div>
          {provider === "CLOUD" && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="wa-key-phone">Phone Number ID (Cloud)</Label>
              <Input id="wa-key-phone" name="phoneId" inputMode="numeric" placeholder="ID nomor WhatsApp Business" />
            </div>
          )}
          <div className="space-y-1 sm:col-span-4">
            <Label htmlFor="wa-key-note">Catatan (opsional)</Label>
            <Input id="wa-key-note" name="note" placeholder="cth. device utama CS" />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" size="compact" disabled={pending === "add"}>
              {pending === "add" ? "Menyimpan…" : "Tambah Key"}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {keys.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada API key tersimpan. Tambahkan di form atas.</p>
          )}
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line-warm px-3 py-2.5">
              <Badge variant={PROVIDER_BADGE[k.provider]?.variant ?? "neutral"}>
                {PROVIDER_BADGE[k.provider]?.label ?? k.provider}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {k.label}
                  {k.isActive && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success-soft-foreground">aktif</span>}
                </p>
                <p className="font-data text-[11px] text-muted-foreground">
                  token {k.tokenMasked}
                  {k.phoneId ? ` · phoneId ${k.phoneId}` : ""}
                  {k.note ? ` · ${k.note}` : ""}
                </p>
              </div>
              {!k.isActive && (
                <Button type="button" size="compact" variant="outline" disabled={pending === "act"} onClick={() => void act(k.id)}>
                  <ZapIcon className="h-3.5 w-3.5" />
                  Pakai
                </Button>
              )}
              <ConfirmButton
                tone="danger"
                title="Hapus API key ini?"
                description="Key dihapus dari daftar. Pengaturan aktif tidak berubah."
                confirmLabel="Ya, hapus"
                onConfirm={async () => {
                  await del(k.id);
                  return undefined;
                }}
                trigger={
                  <Button type="button" size="compact" variant="ghost" className="text-muted-foreground hover:text-danger" disabled={pending === "del"}>
                    <Trash2Icon className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
