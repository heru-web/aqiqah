"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { createBranchAction, createRoleAction, createUserAction, type SystemState } from "@/server/actions/system";
import { permissionGroups } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function FormShell({
  title,
  description,
  state,
  children,
  pending,
  submitLabel,
  action,
}: {
  title: string;
  description: string;
  state: SystemState;
  children: React.ReactNode;
  pending: boolean;
  submitLabel: string;
  action: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      Promise.resolve().then(() => setOpen(false));
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="h-4 w-4" />
          {submitLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          {children}
          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateUserDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SystemState, FormData>(createUserAction, undefined);
  return (
    <FormShell
      title="Pengguna Baru"
      description="Buat akun login untuk tim. Password awal bisa diubah user."
      state={state}
      pending={pending}
      submitLabel="Buat Pengguna"
      action={action}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Nama *</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password Awal *</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Roles</Label>
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="roleIds" value={r.id} className="h-4 w-4 rounded border-input accent-primary" />
            {r.name}
          </label>
        ))}
      </div>
    </FormShell>
  );
}

const GROUPS = [...permissionGroups().entries()];

export function CreateRoleDialog() {
  const [state, action, pending] = useActionState<SystemState, FormData>(createRoleAction, undefined);
  return (
    <FormShell
      title="Role Baru"
      description="Buat role dengan kombinasi permission. Superadmin otomatis punya semua."
      state={state}
      pending={pending}
      submitLabel="Buat Role"
      action={action}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nama Role *</Label>
          <Input id="name" name="name" required placeholder="Sales Team" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug *</Label>
          <Input id="slug" name="slug" required placeholder="sales-team" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea id="description" name="description" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-foreground">Permissions</legend>
        {GROUPS.map(([group, perms]) => (
          <div key={group} className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{group}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {perms.map((p) => (
                <label key={p.key} className="flex items-center gap-1.5 text-xs text-foreground">
                  <input type="checkbox" name="permissions" value={p.key} className="h-4 w-4 rounded border-input accent-primary" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </FormShell>
  );
}

export function CreateBranchDialog() {
  const [state, action, pending] = useActionState<SystemState, FormData>(createBranchAction, undefined);
  return (
    <FormShell
      title="Cabang Baru"
      description="Perluasan usaha — setiap cabang punya data dan stok sendiri."
      state={state}
      pending={pending}
      submitLabel="Buat Cabang"
      action={action}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="code">Kode *</Label>
          <Input id="code" name="code" required placeholder="MAG2" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nama *</Label>
          <Input id="name" name="name" required placeholder="Madani Aqiqah Magelang" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">Pemilik / Kepala Cabang</Label>
          <Input id="ownerName" name="ownerName" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Kota</Label>
          <Input id="city" name="city" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Alamat</Label>
        <Textarea id="address" name="address" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telepon</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="igHandle">Instagram</Label>
          <Input id="igHandle" name="igHandle" placeholder="@madani.aqiqah" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
      </div>
    </FormShell>
  );
}