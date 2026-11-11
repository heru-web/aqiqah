"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
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
  createPersonAction,
  updatePersonAction,
  type CrmFormState,
} from "@/server/actions/crm";
import type { OrganizationOption, UserOption } from "./types";

export interface PersonFormData {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  jobTitle: string | null;
  city: string | null;
  organizationId: string | null;
  ownerId: string | null;
  notes: string | null;
}

export function PersonDialog({
  person,
  organizations,
  users,
  defaultOwnerId,
  trigger,
}: {
  person?: PersonFormData;
  organizations: OrganizationOption[];
  users: UserOption[];
  defaultOwnerId?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = person ? updatePersonAction.bind(null, person.id) : createPersonAction;
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
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person ? "Ubah Kontak" : "Kontak Baru"}</DialogTitle>
          <DialogDescription>Simpan data orang yang terhubung dengan deal.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="person-name">Nama *</Label>
            <Input id="person-name" name="name" required minLength={2} defaultValue={person?.name ?? ""} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-phone">Telepon</Label>
              <Input id="person-phone" name="phone" defaultValue={person?.phone ?? ""} placeholder="0812-…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-wa">WhatsApp</Label>
              <Input id="person-wa" name="whatsapp" defaultValue={person?.whatsapp ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-email">Email</Label>
              <Input id="person-email" name="email" type="email" defaultValue={person?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-job">Jabatan</Label>
              <Input id="person-job" name="jobTitle" defaultValue={person?.jobTitle ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-city">Kota</Label>
              <Input id="person-city" name="city" defaultValue={person?.city ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-org">Perusahaan</Label>
              <Select id="person-org" name="organizationId" defaultValue={person?.organizationId ?? ""}>
                <option value="">— Tanpa perusahaan —</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-owner">Pemilik</Label>
            <Select id="person-owner" name="ownerId" defaultValue={person?.ownerId ?? defaultOwnerId ?? ""}>
              <option value="">Belum ditugaskan</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-notes">Catatan</Label>
            <Textarea id="person-notes" name="notes" rows={2} defaultValue={person?.notes ?? ""} />
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}

          {state?.duplicate && (
            <div className="rounded-md bg-gold/15 px-3 py-2 text-sm ring-1 ring-gold/25">
              <p className="text-gold-soft-foreground">
                Ada kontak serupa tersimpan: <strong>{state.duplicate.name}</strong>. Data ini tidak disimpan sebagai kontak baru.
              </p>
              <Link href={`/crm/contacts/people/${state.duplicate.id}`} className="mt-2 inline-block text-sm font-medium text-primary underline">
                Buka kontak {state.duplicate.name}
              </Link>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              <PlusIcon className="h-4 w-4" /> {pending ? "Menyimpan…" : person ? "Simpan Perubahan" : "Simpan Kontak"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
