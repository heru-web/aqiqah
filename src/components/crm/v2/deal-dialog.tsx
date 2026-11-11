"use client";

import { useActionState, useState } from "react";
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
import { CRM_PRODUCT_OPTIONS } from "@/lib/crm/crm";
import {
  createDealAction,
  updateDealAction,
  type CrmFormState,
} from "@/server/actions/crm";
import type {
  DealCardData,
  OrganizationOption,
  PersonOption,
  StageData,
  UserOption,
} from "./types";

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function DealDialog({
  deal,
  stages,
  people,
  organizations,
  users,
  defaultStageId,
  trigger,
}: {
  deal?: DealCardData;
  stages: StageData[];
  people: PersonOption[];
  organizations: OrganizationOption[];
  users: UserOption[];
  defaultStageId?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const bound = deal ? updateDealAction.bind(null, deal.id) : createDealAction;
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

  const activeStage = deal?.stageId ?? defaultStageId ?? stages[0]?.id ?? "";
  const isLost = stages.find((stage) => stage.id === activeStage)?.type === "LOST";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "Ubah Deal" : "Deal Baru"}</DialogTitle>
          <DialogDescription>
            {deal
              ? "Perbarui nilai, tahap, pemilik, dan jadwal penutupan deal."
              : "Catat peluang baru di pipeline CRM."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">Judul deal *</Label>
            <Input
              id="deal-title"
              name="title"
              required
              minLength={2}
              defaultValue={deal?.title ?? ""}
              placeholder="Aqiqah anak Bapak…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-value">Nilai (Rp)</Label>
              <Input
                id="deal-value"
                name="value"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                defaultValue={deal?.value ?? ""}
                placeholder="3500000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-stage">Tahap *</Label>
              <Select id="deal-stage" name="stageId" defaultValue={activeStage} required>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-person">Kontak orang</Label>
              <Select id="deal-person" name="personId" defaultValue={deal?.personId ?? ""}>
                <option value="">— Tanpa kontak —</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.organizationName ? ` · ${person.organizationName}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-org">Perusahaan</Label>
              <Select id="deal-org" name="organizationId" defaultValue={deal?.organizationId ?? ""}>
                <option value="">— Tanpa perusahaan —</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-owner">Pemilik</Label>
              <Select id="deal-owner" name="ownerId" defaultValue={deal?.ownerId ?? ""}>
                <option value="">Belum ditugaskan</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-close">Perkiraan penutupan</Label>
              <Input
                id="deal-close"
                name="expectedCloseDate"
                type="date"
                defaultValue={toDateInput(deal?.expectedCloseDate)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="deal-source">Sumber</Label>
              <Select id="deal-source" name="source" defaultValue={deal?.source ?? "WALK_IN"}>
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-product">Minat produk</Label>
              <Select
                id="deal-product"
                name="productInterest"
                defaultValue={deal?.productInterest ?? ""}
              >
                <option value="">Pilih…</option>
                {CRM_PRODUCT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isLost && (
            <div className="space-y-1.5">
              <Label htmlFor="deal-lost">Alasan batal</Label>
              <Input
                id="deal-lost"
                name="lostReason"
                defaultValue={deal?.lostReason ?? ""}
                placeholder="Harga, jadwal, atau alasan lain"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Catatan</Label>
            <Textarea id="deal-notes" name="notes" rows={3} defaultValue={deal?.notes ?? ""} />
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
              {pending ? (
                "Menyimpan…"
              ) : deal ? (
                <>
                  <PencilIcon className="h-4 w-4" /> Simpan Perubahan
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" /> Simpan Deal
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
