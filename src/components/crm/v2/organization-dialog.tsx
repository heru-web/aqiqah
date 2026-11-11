"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2Icon } from "lucide-react";
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
import {
  createOrganizationAction,
  updateOrganizationAction,
  type CrmFormState,
} from "@/server/actions/crm";
import type { UserOption } from "./types";

export interface OrganizationFormData {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  ownerId: string | null;
  notes: string | null;
}

export function OrganizationDialog({
  organization,
  users,
  defaultOwnerId,
  trigger,
}: {
  organization?: OrganizationFormData;
  users: UserOption[];
  defaultOwnerId?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = organization
    ? updateOrganizationAction.bind(null, organization.id)
    : createOrganizationAction;
  const [state, action, pending] = useActionState<CrmFormState, FormData>(
    async (previous, formData) => {
      const result = await bound(previous, formData);
      if (result?.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    undefined
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{organization ? "Ubah Perusahaan" : "Perusahaan Baru"}</DialogTitle>
          <DialogDescription>Data perusahaan atau instansi asal kontak.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nama *</Label>
            <Input id="org-name" name="name" required minLength={2} defaultValue={organization?.name ?? ""} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-industry">Bidang</Label>
              <Input id="org-industry" name="industry" defaultValue={organization?.industry ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Telepon</Label>
              <Input id="org-phone" name="phone" defaultValue={organization?.phone ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-email">Email</Label>
              <Input id="org-email" name="email" type="email" defaultValue={organization?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-city">Kota</Label>
              <Input id="org-city" name="city" defaultValue={organization?.city ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-address">Alamat</Label>
            <Textarea id="org-address" name="address" rows={2} defaultValue={organization?.address ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-owner">Pemilik</Label>
            <Select id="org-owner" name="ownerId" defaultValue={organization?.ownerId ?? defaultOwnerId ?? ""}>
              <option value="">Belum ditugaskan</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-notes">Catatan</Label>
            <Textarea id="org-notes" name="notes" rows={2} defaultValue={organization?.notes ?? ""} />
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}

          {state?.duplicate && (
            <div className="rounded-md bg-gold/15 px-3 py-2 text-sm ring-1 ring-gold/25">
              <p className="text-gold-soft-foreground">
                Ada perusahaan serupa tersimpan: <strong>{state.duplicate.name}</strong>. Data ini tidak disimpan sebagai perusahaan baru.
              </p>
              <Link href={`/crm/contacts/organizations/${state.duplicate.id}`} className="mt-2 inline-block text-sm font-medium text-primary underline">
                Buka perusahaan {state.duplicate.name}
              </Link>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <Building2Icon className="h-4 w-4" />{" "}
              {pending ? "Menyimpan…" : organization ? "Simpan Perubahan" : "Simpan Perusahaan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
