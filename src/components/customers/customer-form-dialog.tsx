"use client";

import { useEffect } from "react";
import { useActionState } from "react";
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
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerFormState,
} from "@/server/actions/customers";

export interface CustomerFormValue {
  id?: string;
  name: string;
  type: "PERUSAHAAN" | "PERORANGAN";
  phone?: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  province?: string;
  address?: string;
  npwp?: string;
  source?: string;
  notes?: string;
  ayahName?: string;
  ibuName?: string;
  birthPlace?: string;
  birthDate?: string;
  packageName?: string;
  deliveryDate?: string;
  deliverySlot?: string;
  consent?: string;
}

interface Props {
  customer?: CustomerFormValue;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export function CustomerFormDialog({ customer, trigger, defaultOpen }: Props) {
  const router = useRouter();
  const action = customer?.id ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(action, undefined);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><PlusIcon className="h-4 w-4" />Tambah</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.id ? "Edit Pelanggan" : "Tambah Pelanggan"}</DialogTitle>
          <DialogDescription>
            {customer?.id ? "Perbarui data shohibul/pelanggan." : "Data pelanggan baru untuk order & CRM."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {customer?.id && <input type="hidden" name="id" value={customer.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama *</Label>
            <Input id="name" name="name" required defaultValue={customer?.name ?? ""} placeholder="cth. Bpk. Agus Santoso" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipe</Label>
              <Select id="type" name="type" defaultValue={customer?.type ?? "PERORANGAN"}>
                <option value="PERORANGAN">Perorangan</option>
                <option value="PERUSAHAAN">Perusahaan / Lembaga</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Kota</Label>
              <Input id="city" name="city" defaultValue={customer?.city ?? ""} placeholder="Bandung" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} placeholder="0812-..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" defaultValue={customer?.whatsapp ?? ""} placeholder="0812-..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Sumber</Label>
              <Input id="source" name="source" defaultValue={customer?.source ?? ""} placeholder="IG / referensi / walk-in" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Alamat</Label>
            <Textarea id="address" name="address" defaultValue={customer?.address ?? ""} />
          </div>
          <div className="mt-2 rounded-xl bg-primary/5 p-3">
              <p className="text-sm font-semibold text-foreground">Data Aqiqah (Alhamdulillah Barakallah 🤲)</p>
              <p className="text-[11px] text-muted-foreground">
                Kolom di bawah mengikuti form pemesanan resmi: pelanggan di pastikan terisi lebih lengkap.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ayah-name">Nama Ayah</Label>
                <Input id="ayah-name" name="ayahName" defaultValue={customer?.ayahName ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ibu-name">Nama Ibu</Label>
                <Input id="ibu-name" name="ibuName" defaultValue={customer?.ibuName ?? ""} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="birth-place">Tempat Lahir</Label>
                <Input id="birth-place" name="birthPlace" defaultValue={customer?.birthPlace ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birth-date">Tanggal Lahir</Label>
                <Input id="birth-date" name="birthDate" type="date" defaultValue={customer?.birthDate ?? ""} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="package-name">Paket yang dipesan</Label>
              <Input
                id="package-name"
                name="packageName"
                defaultValue={customer?.packageName ?? ""}
                placeholder="cth. Paket Aqiqah Lite 1 Ekor Betina 60 Porsi"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-date">Hari/Tanggal kirim</Label>
                <Input id="delivery-date" name="deliveryDate" type="date" defaultValue={customer?.deliveryDate ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery-slot">Jam kirim</Label>
                <Input id="delivery-slot" name="deliverySlot" defaultValue={customer?.deliverySlot ?? ""} placeholder="cth. Jam 17.00" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="consent">Dokumentasi (boleh foto &amp; video, boleh publikasi)</Label>
              <Textarea
                id="consent"
                name="consent"
                defaultValue={customer?.consent ?? ""}
                placeholder={"boleh foto & video\nboleh publikasi"}
              />
              <p className="text-[10.5px] text-muted-foreground">
                Cukup tambahkan baris &quot;boleh foto &#38; video&quot; / &quot;boleh publikasi&quot; bila berkenan.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan khusus</Label>
              <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} />
            </div>

          {state?.error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : customer?.id ? "Simpan Perubahan" : "Tambah Pelanggan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditCustomerButton({ customer }: { customer: CustomerFormValue }) {
  return (
    <CustomerFormDialog
      customer={customer}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Edit">
          <PencilIcon className="h-4 w-4" />
        </Button>
      }
    />
  );
}