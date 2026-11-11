"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, PencilIcon } from "lucide-react";
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
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { createLeadAction, updateLeadAction, type LeadFormState } from "@/server/actions/leads";

export interface LeadFormData {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  address?: string | null;
  source: string;
  productInterest: string | null;
  budget: string | null;
  notes: string | null;
  assignedTo: string | null;
  nextFollowupAt: Date | string | null;
}

interface OwnerOption {
  id: string;
  name: string;
}

const PRODUCT_OPTIONS = [
  { value: "kambing", label: "Kambing" },
  { value: "sapi", label: "Sapi" },
  { value: "paket", label: "Paket Olahan" },
  { value: "pesanan_olah", label: "Pesanan Olahan" },
];

function toLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadFormDialog({
  lead,
  owners,
  currentUserId,
  trigger,
}: {
  lead?: LeadFormData;
  owners: OwnerOption[];
  currentUserId: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formAction = lead ? updateLeadAction.bind(null, lead.id) : createLeadAction;
  const [state, action, pending] = useActionState<LeadFormState, FormData>(
    async (previous, formData) => {
      const result = await formAction(previous, formData);
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
          <DialogTitle>{lead ? "Ubah Lead" : "Lead Baru"}</DialogTitle>
          <DialogDescription>
            {lead
              ? "Perbarui data prospek, pemilik, dan jadwal follow-up."
              : "Masukkan calon shohibul untuk pipeline CRM."}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nama *</Label>
            <Input
              id="lead-name"
              name="name"
              required
              minLength={2}
              defaultValue={lead?.name ?? ""}
              placeholder="Nama calon"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Telepon</Label>
              <Input id="lead-phone" name="phone" defaultValue={lead?.phone ?? ""} placeholder="0812-…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-whatsapp">WhatsApp</Label>
              <Input id="lead-whatsapp" name="whatsapp" defaultValue={lead?.whatsapp ?? ""} placeholder="0812-…" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" name="email" type="email" defaultValue={lead?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Perusahaan</Label>
              <Input id="lead-company" name="company" defaultValue={lead?.company ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-city">Kota</Label>
              <Input id="lead-city" name="city" defaultValue={lead?.city ?? ""} placeholder="Bandung" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Sumber</Label>
              <Select id="lead-source" name="source" defaultValue={lead?.source ?? "WALK_IN"}>
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-address">Alamat</Label>
            <Input
              id="lead-address"
              name="address"
              defaultValue={lead?.address ?? ""}
              placeholder="Jl. Contoh No. 12, RT 03/RW 05"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-product">Minat</Label>
              <Select id="lead-product" name="productInterest" defaultValue={lead?.productInterest ?? ""}>
                <option value="">Pilih…</option>
                {PRODUCT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-budget">Kisaran Budget (Rp)</Label>
              <Input
                id="lead-budget"
                name="budget"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={lead?.budget ?? ""}
                placeholder="3000000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-owner">Penanggung jawab</Label>
              <Select id="lead-owner" name="assignedTo" defaultValue={lead?.assignedTo ?? currentUserId}>
                <option value="">Belum ditugaskan</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-followup">Follow-up berikutnya</Label>
              <Input
                id="lead-followup"
                name="nextFollowupAt"
                type="datetime-local"
                defaultValue={toLocalInput(lead?.nextFollowupAt)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Catatan</Label>
            <Textarea id="lead-notes" name="notes" rows={3} defaultValue={lead?.notes ?? ""} />
          </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : lead ? "Simpan Perubahan" : "Simpan Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddLeadDialog({
  owners,
  currentUserId,
}: {
  owners: OwnerOption[];
  currentUserId: string;
}) {
  return (
    <LeadFormDialog
      owners={owners}
      currentUserId={currentUserId}
      trigger={
        <Button>
          <PlusIcon className="h-4 w-4" /> Lead Baru
        </Button>
      }
    />
  );
}

export function EditLeadDialog({
  lead,
  owners,
  currentUserId,
}: {
  lead: LeadFormData;
  owners: OwnerOption[];
  currentUserId: string;
}) {
  return (
    <LeadFormDialog
      lead={lead}
      owners={owners}
      currentUserId={currentUserId}
      trigger={
        <Button variant="outline">
          <PencilIcon className="h-4 w-4" /> Ubah
        </Button>
      }
    />
  );
}
